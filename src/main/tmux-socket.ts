export const TMUX_SOCKET_NAME = 'ccc'

export function tmuxArgs(...args: string[]): string[] {
  const socket = process.env.CCC_TEST_TMUX_SOCKET ?? TMUX_SOCKET_NAME
  return ['-L', socket, ...args]
}

export function tmuxArgsForRemote(...args: string[]): string {
  const socket = process.env.CCC_TEST_TMUX_SOCKET ?? TMUX_SOCKET_NAME
  const escaped = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
  return `tmux -L ${socket} ${escaped}`
}
