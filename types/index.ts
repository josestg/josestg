export type ContentMetadata = {
  title: string;
  slug: string;
  readTime: string;
  dateCreated: string;
  categories: string[];
  intro: string;
  useLatex: boolean;
};

export type ParsedMarkdown = {
  metadata: ContentMetadata;
  htmlString: string;
};

export type GithubRepository = {
  fork: boolean;
  language: string;
  stargazers_count: number;
};

export type GithubUser = {
  name: string;
  username: string;
  avatar_url: string;
  bio: string;
  followers: number;
};
