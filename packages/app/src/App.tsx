import { ArticleList } from "@/features/articles/article-list"
import { config } from "./config"


function App() {
  return <ArticleList config={config} />
}

export default App