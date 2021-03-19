import useSWR from "swr";
import React from "react";
import {
  Flex,
  Stack,
  Text,
  Skeleton,
  SkeletonCircle,
  Wrap,
} from "@chakra-ui/react";

import { Avatar } from "./avatar";
import { fetcher } from "../libs/fetcher";
import { GithubUser } from "../types";

export const UserCard: React.FC = () => {
  const { data } = useSWR<GithubUser>("/api/github/user", fetcher);

  if (!data) {
    return (
      <Flex align="center">
        <SkeletonCircle size="42px" />
        <Stack ml="4">
          <Skeleton width="140px" height="20px" />
          <Skeleton width="80px" height="12px" />
        </Stack>
      </Flex>
    );
  }

  return (
    <Flex>
      <Avatar url={data.avatar_url} />
      <Wrap>
        <Flex direction="column" justifyContent="center">
          <Text fontWeight="bold" fontSize="sm">
            {data.name}
          </Text>
          <Text fontSize="xs">{data.bio}</Text>
        </Flex>
      </Wrap>
    </Flex>
  );
};
