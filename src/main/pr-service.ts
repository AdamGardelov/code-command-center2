import { execFile } from 'child_process'
import { BrowserWindow } from 'electron'
import type { ConfigService } from './config-service'
import type { PullRequest, PrState, PrConfig } from '../shared/types'
import { parseRawPr, categorizePrs } from './pr-models'

const PR_FIELDS = `
  id number title url
  author { login }
  isDraft headRefName
  additions deletions
  reviewDecision
  reviewRequests(first: 10) { nodes { requestedReviewer { ... on User { login } ... on Team { name } } } }
  latestReviews(first: 10) { nodes { author { login } state } }
  comments { totalCount }
  reviewThreads(first: 100) { nodes { isResolved } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
  createdAt updatedAt
`

function gh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

export class PrService {
  private configService: ConfigService
  private window: BrowserWindow | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private currentUser = ''
  private previousPrs: PullRequest[] = []
  private isFirstPoll = true
  private lastState: Partial<PrState> = {}

  constructor(configService: ConfigService) {
    this.configService = configService
  }

  setWindow(win: BrowserWindow): void {
    this.window = win

    win.on('focus', () => {
      if (!this.timer && this.configService.get().features.pullRequests) {
        this.start()
      }
    })

    win.on('blur', () => {
      // Keep polling in background but at reduced rate is not needed for v1
      // Could stop here if we want to save API calls
    })
  }

  start(): void {
    const config = this.configService.get()
    if (!config.features.pullRequests || !config.prConfig) return

    this.stop()
    void this.pollOnce()

    const interval = (config.prConfig.pollInterval ?? 120) * 1000
    this.timer = setInterval(() => void this.pollOnce(), interval)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async refresh(): Promise<void> {
    await this.pollOnce()
  }

  private async pollOnce(): Promise<void> {
    const config = this.configService.get()
    if (!config.prConfig) return

    const prConfig = config.prConfig

    this.sendState({ isLoading: true })

    try {
      if (!this.currentUser) {
        this.currentUser = await this.fetchCurrentUser()
      }

      const prs = await this.fetchAllPrs(prConfig)
      const { myPrs, teamPrs, reviewPrs, attentionItems } = categorizePrs(
        prs,
        this.currentUser,
        prConfig.showMyDrafts,
        prConfig.showOthersDrafts
      )

      const dismissedSet = new Set(prConfig.dismissedAttention)
      const filteredAttention = attentionItems.filter(a => !dismissedSet.has(a.pr.id))

      const state: PrState = {
        myPrs,
        teamPrs,
        reviewPrs,
        attentionItems: filteredAttention,
        currentUser: this.currentUser,
        lastUpdated: new Date().toISOString(),
        isLoading: false,
        error: null,
      }

      if (!this.isFirstPoll) {
        this.detectChanges(prs, prConfig)
      }
      this.isFirstPoll = false
      this.previousPrs = prs

      this.sendState(state)
    } catch (err) {
      this.sendState({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  private async fetchCurrentUser(): Promise<string> {
    const result = await gh(['api', 'graphql', '-f', 'query=query { viewer { login } }'])
    const data = JSON.parse(result)
    return data.data.viewer.login
  }

  private async fetchAllPrs(prConfig: PrConfig): Promise<PullRequest[]> {
    const allPrs: PullRequest[] = []

    // Fetch from pinned repos
    if (prConfig.pinnedRepos.length > 0) {
      const repoPrs = await this.fetchRepoPrs(prConfig.githubOrg, prConfig.pinnedRepos)
      allPrs.push(...repoPrs)
    }

    // Search for team member PRs + review requests
    if (prConfig.teamMembers.length > 0) {
      const searchPrs = await this.searchPrs(prConfig.githubOrg, prConfig.teamMembers)
      // Deduplicate by id
      const existingIds = new Set(allPrs.map(pr => pr.id))
      for (const pr of searchPrs) {
        if (!existingIds.has(pr.id)) {
          allPrs.push(pr)
          existingIds.add(pr.id)
        }
      }
    }

    // Search for PRs requesting my review
    if (this.currentUser) {
      const reviewPrs = await this.searchReviewRequested(prConfig.githubOrg)
      const existingIds = new Set(allPrs.map(pr => pr.id))
      for (const pr of reviewPrs) {
        if (!existingIds.has(pr.id)) {
          allPrs.push(pr)
          existingIds.add(pr.id)
        }
      }
    }

    return allPrs
  }

  private async fetchRepoPrs(org: string, repos: string[]): Promise<PullRequest[]> {
    const prs: PullRequest[] = []
    // Batch max 10 repos per query
    for (let i = 0; i < repos.length; i += 10) {
      const batch = repos.slice(i, i + 10)
      const query = batch.map((repo, idx) => {
        const repoName = repo.includes('/') ? repo.split('/')[1] : repo
        const repoOwner = repo.includes('/') ? repo.split('/')[0] : org
        return `repo${idx}: repository(owner: "${repoOwner}", name: "${repoName}") {
          nameWithOwner
          pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
            nodes { ${PR_FIELDS} }
          }
        }`
      }).join('\n')

      const result = await gh(['api', 'graphql', '-f', `query=query { ${query} }`])
      const data = JSON.parse(result)

      for (let idx = 0; idx < batch.length; idx++) {
        const repoData = data.data[`repo${idx}`]
        if (!repoData) continue
        const repoFullName = repoData.nameWithOwner
        for (const node of repoData.pullRequests.nodes) {
          prs.push(parseRawPr(node, repoFullName))
        }
      }
    }
    return prs
  }

  private async searchPrs(org: string, authors: string[]): Promise<PullRequest[]> {
    const prs: PullRequest[] = []
    // Batch max 10 searches per query
    for (let i = 0; i < authors.length; i += 10) {
      const batch = authors.slice(i, i + 10)
      const query = batch.map((author, idx) => {
        return `search${idx}: search(query: "is:pr is:open org:${org} author:${author}", type: ISSUE, first: 50) {
          nodes { ... on PullRequest { ${PR_FIELDS} repository { nameWithOwner } } }
        }`
      }).join('\n')

      const result = await gh(['api', 'graphql', '-f', `query=query { ${query} }`])
      const data = JSON.parse(result)

      for (let idx = 0; idx < batch.length; idx++) {
        const searchData = data.data[`search${idx}`]
        if (!searchData) continue
        for (const node of searchData.nodes) {
          if (node.repository) {
            prs.push(parseRawPr(node, node.repository.nameWithOwner))
          }
        }
      }
    }
    return prs
  }

  private async searchReviewRequested(org: string): Promise<PullRequest[]> {
    const query = `search0: search(query: "is:pr is:open org:${org} review-requested:${this.currentUser}", type: ISSUE, first: 50) {
      nodes { ... on PullRequest { ${PR_FIELDS} repository { nameWithOwner } } }
    }`

    const result = await gh(['api', 'graphql', '-f', `query=query { ${query} }`])
    const data = JSON.parse(result)

    const prs: PullRequest[] = []
    const searchData = data.data.search0
    if (searchData) {
      for (const node of searchData.nodes) {
        if (node.repository) {
          prs.push(parseRawPr(node, node.repository.nameWithOwner))
        }
      }
    }
    return prs
  }

  private detectChanges(newPrs: PullRequest[], prConfig: PrConfig): void {
    if (!this.window || this.window.isDestroyed()) return

    const oldMap = new Map(this.previousPrs.map(pr => [pr.id, pr]))

    for (const pr of newPrs) {
      if (pr.author !== this.currentUser) {
        // Check for new team PR
        if (!oldMap.has(pr.id) && prConfig.notifications.newPr) {
          this.sendNotification(`New PR`, `${pr.repo} #${pr.number}: ${pr.title}`)
        }
        continue
      }

      const old = oldMap.get(pr.id)
      if (!old) continue

      if (old.reviewDecision !== 'approved' && pr.reviewDecision === 'approved' && prConfig.notifications.approved) {
        this.sendNotification('PR Approved', `${pr.repo} #${pr.number}: ${pr.title}`)
      }

      if (old.reviewDecision !== 'changes_requested' && pr.reviewDecision === 'changes_requested' && prConfig.notifications.changesRequested) {
        this.sendNotification('Changes Requested', `${pr.repo} #${pr.number}: ${pr.title}`)
      }

      if (pr.commentCount > old.commentCount && prConfig.notifications.newComment) {
        this.sendNotification('New Comment', `${pr.repo} #${pr.number}: ${pr.title}`)
      }

      if (pr.reviewers.length > old.reviewers.length && prConfig.notifications.newReviewer) {
        this.sendNotification('New Reviewer', `${pr.repo} #${pr.number}: ${pr.title}`)
      }
    }
  }

  private sendNotification(title: string, body: string): void {
    if (!this.window || this.window.isDestroyed()) return

    const { Notification } = require('electron') as typeof import('electron')
    const config = this.configService.get()
    if (!config.notificationsEnabled) return

    if (this.window.isFocused()) {
      this.window.webContents.send('notification:toast', {
        sessionName: 'PR',
        message: `${title}: ${body}`,
        color: '#e9c880',
      })
    } else {
      const notification = new Notification({ title, body })
      notification.on('click', () => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.show()
          this.window.focus()
          this.window.webContents.send('pr:navigate')
        }
      })
      notification.show()
    }
  }

  getState(): Partial<PrState> {
    return this.lastState
  }

  private sendState(partial: Partial<PrState>): void {
    this.lastState = { ...this.lastState, ...partial }
    if (!this.window || this.window.isDestroyed()) return
    this.window.webContents.send('pr:state', partial)
  }
}
