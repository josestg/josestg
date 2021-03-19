import type { NextApiRequest, NextApiResponse } from "next";

import { GithubRepository } from "../../../types";

function isExcludedLanguage(language: string) {
  return (
    language === "HTML" || language === "CSS" || language === "Jupyter Notebook"
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const userReposResponse = await fetch(
    "https://api.github.com/users/josestg/repos"
  );

  const repositories: GithubRepository[] = await userReposResponse.json();
  const languages = repositories
    .filter(
      (repository) =>
        !repository.fork && !isExcludedLanguage(repository.language)
    )
    .map((repository) => repository.language);

  const total = languages.length;
  const persentase = languages.reduce((accumulator, language) => {
    if (accumulator[language] === undefined) {
      accumulator[language] = 0;
    }
    accumulator[language] += 100 / total;
    return accumulator;
  }, {});

  const stats = Object.keys(persentase)
    .map((key) => {
      return {
        name: key,
        persentase: persentase[key],
      };
    })
    .sort((a, b) => b.persentase - a.persentase);

  res.setHeader(
    "Cache-Control",
    "public, s-maxage=1200, stale-while-revalidate=600"
  );

  res.status(200).json(stats);
}
