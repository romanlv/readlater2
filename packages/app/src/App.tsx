import { ArticleList } from "@/features/articles/article-list"
import { GoogleSheetsConfig } from "@/features/articles/types"

// Configuration - in production, this would come from environment variables
const config: GoogleSheetsConfig = {
  CLIENT_ID: '936857689188-12248fshkfu33b11mgj5eele7ggosrl6.apps.googleusercontent.com',
  API_KEY: 'AIzaSyCy2RnWO-ANAGOnoC88EmWWu8FYwt0kZ5c',
  SPREADSHEET_ID: '1C7OU11RFuSIG_alJKx7UzbhqaXRyRrBJzOTLjuabIm8',
};

function App() {
  return <ArticleList config={config} />
}

export default App