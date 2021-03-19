import type { NextApiRequest, NextApiResponse } from "next";
import { GithubRepository } from "../../../types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const userReposResponse = await fetch(
    "https://api.github.com/users/josestg/repos?per_page=100"
  );

  const repositories: GithubRepository[] = await userReposResponse.json();

  const stars = repositories.reduce((accumulator, repository) => {
    if (repository.fork) return accumulator;
    return accumulator + repository.stargazers_count;
  }, 0);

  res.setHeader(
    "Cache-Control",
    "public, s-maxage=1200, stale-while-revalidate=600"
  );

  res.status(200).json({ stars });
}
