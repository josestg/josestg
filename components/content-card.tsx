import React from "react";
import NextLink from "next/link";
import {
  Stack,
  Heading,
  Text,
  useColorModeValue,
  HStack,
} from "@chakra-ui/react";

import { pWithLineClamp } from "./utils";
import { ContentMetadata } from "../types";

type Props = {
  metadata: ContentMetadata;
};

export const ContentCard: React.FC<Props> = ({ metadata }) => {
  const textColor = useColorModeValue("gray.600", "gray.300");

  return (
    <Stack>
      <HStack justify="space-between">
        <NextLink href={"/posts/[slug]"} as={`/posts/${metadata.slug}`}>
          <Heading fontSize={{ sm: "lg", md: "xl" }} as="h2" cursor="pointer">
            {metadata.title}
          </Heading>
        </NextLink>
      </HStack>
      <Stack color={textColor}>
        <Text
          as={pWithLineClamp(2)}
          lineHeight="short"
          fontSize={{ sm: "sm", md: "md" }}
        >
          {metadata.intro}
        </Text>
        <Text fontSize="xs">
          {metadata.dateCreated} &bull; {metadata.readTime}
        </Text>
      </Stack>
    </Stack>
  );
};
