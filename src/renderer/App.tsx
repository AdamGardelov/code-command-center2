import Layout from './components/Layout'
import { useKeyboard } from './hooks/useKeyboard'

export default function App(): React.JSX.Element {
  useKeyboard()
  return <Layout />
}
