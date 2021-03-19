import type { NextApiRequest, NextApiResponse } from "next";

import { GithubUser } from "../../../types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const userResponse = await fetch("https://api.github.com/users/josestg");

  const user = await userResponse.json();

  const userSummary: GithubUser = {
    name: user.name,
    bio: user.bio,
    username: user.login,
    avatar_url: user.avatar_url,
    followers: user.followers,
  };

  res.setHeader(
    "Cache-Control",
    "public, s-maxage=1200, stale-while-revalidate=600"
  );

  res.status(200).json(userSummary);
}
