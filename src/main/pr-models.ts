import type { PullRequest, PrState } from '../shared/types'

interface RawPrNode {
  id: string
  number: number
  title: string
  url: string
  author: { login: string }
  isDraft: boolean
  headRefName: string
  additions: number
  deletions: number
  reviewDecision: string | null
  reviewRequests: { nodes: Array<{ requestedReviewer: { login?: string; name?: string } | null }> }
  latestReviews: { nodes: Array<{ author: { login: string }; state: string }> }
  comments: { totalCount: number }
  reviewThreads: { nodes: Array<{ isResolved: boolean }> }
  commits: { nodes: Array<{ commit: { statusCheckRollup: { state: string } | null } }> }
  createdAt: string
  updatedAt: string
}

function mapReviewDecision(raw: string | null): PullRequest['reviewDecision'] {
  switch (raw) {
    case 'APPROVED': return 'approved'
    case 'CHANGES_REQUESTED': return 'changes_requested'
    case 'REVIEW_REQUIRED': return 'review_required'
    default: return 'none'
  }
}

function mapChecksStatus(node: RawPrNode): PullRequest['checksStatus'] {
  const rollup = node.commits?.nodes?.[0]?.commit?.statusCheckRollup
  if (!rollup) return 'none'
  switch (rollup.state) {
    case 'SUCCESS': return 'passing'
    case 'FAILURE': case 'ERROR': return 'failing'
    case 'PENDING': case 'EXPECTED': return 'pending'
    default: return 'none'
  }
}

function isBot(login: string): boolean {
  return login.endsWith('[bot]') || login.includes('bot')
}

export function parseRawPr(node: RawPrNode, repoFullName: string): PullRequest {
  const pendingReviewers = (node.reviewRequests?.nodes ?? [])
    .map(r => r.requestedReviewer?.login)
    .filter((login): login is string => !!login && !isBot(login))

  const latestReviewByUser = new Map<string, string>()
  for (const review of (node.latestReviews?.nodes ?? [])) {
    if (!isBot(review.author.login)) {
      latestReviewByUser.set(review.author.login, review.state)
    }
  }

  const reviewers: PullRequest['reviewers'] = []

  for (const login of pendingReviewers) {
    reviewers.push({ login, state: 'pending' })
  }

  for (const [login, state] of latestReviewByUser) {
    if (pendingReviewers.includes(login)) continue
    let mapped: 'approved' | 'changes_requested' | 'pending' = 'pending'
    if (state === 'APPROVED') mapped = 'approved'
    else if (state === 'CHANGES_REQUESTED') mapped = 'changes_requested'
    reviewers.push({ login, state: mapped })
  }

  const commentCount = node.comments?.totalCount ?? 0
  const unresolvedThreads = (node.reviewThreads?.nodes ?? []).filter(t => !t.isResolved).length

  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    repo: repoFullName,
    author: node.author.login,
    isDraft: node.isDraft,
    additions: node.additions,
    deletions: node.deletions,
    reviewDecision: mapReviewDecision(node.reviewDecision),
    reviewers,
    checksStatus: mapChecksStatus(node),
    commentCount,
    unresolvedThreads,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }
}

export function categorizePrs(
  prs: PullRequest[],
  currentUser: string,
  showMyDrafts: boolean,
  showOthersDrafts: boolean
): Pick<PrState, 'myPrs' | 'teamPrs' | 'reviewPrs' | 'attentionItems'> {
  const myPrs: PullRequest[] = []
  const teamPrs: PullRequest[] = []
  const reviewPrs: PullRequest[] = []

  for (const pr of prs) {
    if (pr.author === currentUser) {
      if (pr.isDraft && !showMyDrafts) continue
      myPrs.push(pr)
    } else if (pr.reviewers.some(r => r.login === currentUser && r.state === 'pending')) {
      reviewPrs.push(pr)
    } else {
      if (pr.isDraft && !showOthersDrafts) continue
      teamPrs.push(pr)
    }
  }

  const attentionItems: PrState['attentionItems'] = []
  for (const pr of myPrs) {
    if (pr.reviewDecision === 'approved' && pr.checksStatus === 'passing') {
      attentionItems.push({ pr, reason: 'ready_to_merge' })
    } else if (pr.reviewDecision === 'changes_requested') {
      attentionItems.push({ pr, reason: 'changes_requested' })
    }
  }

  return { myPrs, teamPrs, reviewPrs, attentionItems }
}
