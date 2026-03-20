import type { Category } from '@tech-pulse/shared/types';

export interface FeedSource {
  name: string;
  url: string;
  category: Category;
}

export const FEED_SOURCES: FeedSource[] = [
  // プログラミング
  { name: 'Zenn', url: 'https://zenn.dev/feed', category: 'programming' },
  { name: 'Qiita', url: 'https://qiita.com/popular-items/feed', category: 'programming' },

  { name: 'gihyo.jp', url: 'https://gihyo.jp/feed/rss2', category: 'programming' },
  { name: 'CodeZine', url: 'https://codezine.jp/rss/new/20/index.xml', category: 'programming' },

  // AI・ML
  { name: 'Zenn AI', url: 'https://zenn.dev/topics/ai/feed', category: 'ai-ml' },
  { name: 'Zenn LLM', url: 'https://zenn.dev/topics/llm/feed', category: 'ai-ml' },

  // インフラ・クラウド
  { name: 'Publickey', url: 'https://www.publickey1.jp/atom.xml', category: 'infra-cloud' },
  { name: 'AWS Blog', url: 'https://aws.amazon.com/blogs/aws/feed/', category: 'infra-cloud' },
  { name: 'Google Cloud Blog', url: 'https://cloud.google.com/blog/feed', category: 'infra-cloud' },
  { name: 'Azure Blog', url: 'https://azure.microsoft.com/en-us/blog/feed/', category: 'infra-cloud' },

  // 経済・ビジネス
  { name: '日本経済新聞', url: 'https://assets.wor.jp/rss/rdf/nikkei/news.rdf', category: 'economy' },
  { name: '日経ビジネス', url: 'https://business.nikkei.com/rss/sns/nb.rdf', category: 'economy' },
  { name: '東洋経済オンライン', url: 'https://toyokeizai.net/list/feed/rss', category: 'economy' },

  // 政治・社会
  { name: '共同通信', url: 'https://www.kyodo.co.jp/feed/', category: 'politics' },
  { name: '時事通信', url: 'https://www.jiji.com/rss/ranking.rdf', category: 'politics' },
  { name: 'BBC News Japan', url: 'https://feeds.bbci.co.uk/japanese/rss.xml', category: 'politics' },

  // 科学
  { name: 'Nature Japan', url: 'https://www.natureasia.com/ja-jp/rss/nature', category: 'science' },
  { name: 'ナゾロジー', url: 'https://nazology.kusuguru.co.jp/feed', category: 'science' },
  { name: '日経サイエンス', url: 'https://www.nikkei-science.com/?feed=rss2', category: 'science' },
  { name: 'MIT Tech Review 日本版', url: 'https://www.technologyreview.jp/feed', category: 'science' },

  // スポーツ
  { name: 'Yahoo!スポーツ', url: 'https://news.yahoo.co.jp/rss/topics/sports.xml', category: 'sports' },
  { name: 'NHKスポーツ', url: 'https://www3.nhk.or.jp/rss/news/cat7.xml', category: 'sports' },
  { name: 'Full-Count', url: 'https://full-count.jp/feed/', category: 'sports' },
  { name: 'THE ANSWER', url: 'https://the-ans.jp/feed/', category: 'sports' },
];
