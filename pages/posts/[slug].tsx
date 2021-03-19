import fs from "fs";
import path from "path";
import React from "react";
import NextHead from "next/head";
import grayMatter from "gray-matter";
import countReadingTime from "reading-time";
import { GetStaticPaths, GetStaticProps } from "next";
import { CalendarIcon, TimeIcon } from "@chakra-ui/icons";
import {
  Flex,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  useColorMode,
} from "@chakra-ui/react";

import { CONTENTS_DIRNAME } from "../../config";
import makrdown2Html from "../../libs/md2html-parser";
import { BaseLayout, UserCard } from "../../components";
import { ContentMetadata, ParsedMarkdown } from "../../types";
import { MarkdownRender } from "../../components/markdown-reder";

const ContentReader: React.FC<StaticProps> = ({ parsedMarkdown }) => {
  const { colorMode } = useColorMode();
  const { htmlString, metadata } = parsedMarkdown;

  return (
    <Flex direction="column">
      <NextHead>
        <title>{metadata.title}</title>
        {metadata.useLatex && (
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/katex.min.css"
            integrity="sha384-AfEj0r4/OFrOo5t7NnNe46zW/tFgW6x/bCJG8FqQCEo3+Aro6EYUG4+cU+KJWu/X"
            crossOrigin="anonymous"
          ></link>
        )}
      </NextHead>
      <BaseLayout mb="8">
        <HeadSection metadata={metadata} />
      </BaseLayout>
      <BaseLayout>
        <MarkdownRender
          id="markdown-view"
          colorMode={colorMode}
          dangerouslySetInnerHTML={{ __html: htmlString }}
        />
      </BaseLayout>
    </Flex>
  );
};

const HeadSection: React.FC<{ metadata: ContentMetadata }> = ({ metadata }) => {
  return (
    <Stack spacing="6">
      <Heading
        as="h1"
        fontSize={["5xl", "6xl"]}
        lineHeight="1.2"
        letterSpacing="tight"
        wordBreak="break-word"
        overflowWrap="break-word"
      >
        {metadata.title}
      </Heading>
      <Flex justifyContent="space-between" align="center">
        <UserCard />
        <Stack spacing="1">
          <HStack fontSize="xs">
            <Icon as={CalendarIcon} />
            <Text>{metadata.dateCreated}</Text>
          </HStack>
          <HStack fontSize="xs">
            <Icon as={TimeIcon} />
            <Text>{metadata.readTime}</Text>
          </HStack>
        </Stack>
      </Flex>
    </Stack>
  );
};

export default ContentReader;

type Param = { slug: string };

export const getStaticPaths: GetStaticPaths<Param> = async () => {
  const basePath = path.join(process.cwd(), CONTENTS_DIRNAME);
  const paths = fs.readdirSync(basePath).map((filename) => {
    return {
      params: { slug: filename.replace(".md", "") },
    };
  });

  return {
    paths,
    fallback: false,
  };
};

type StaticProps = {
  parsedMarkdown: ParsedMarkdown;
};

export const getStaticProps: GetStaticProps<StaticProps, Param> = async (
  ctx
) => {
  const slug = ctx.params!.slug;
  const basePath = path.join(process.cwd(), CONTENTS_DIRNAME);
  const rawMarkdown = fs.readFileSync(path.join(basePath, slug + ".md"), {
    encoding: "utf8",
  });

  const { data: markdownMetadata, content } = grayMatter(rawMarkdown);

  const readingTime = countReadingTime(content);

  const metadata: ContentMetadata = {
    slug: slug,
    readTime: readingTime.text,
    intro: markdownMetadata.intro,
    title: markdownMetadata.title,
    useLatex: markdownMetadata.useLatex,
    categories: markdownMetadata.categories,
    dateCreated: markdownMetadata.dateCreated,
  };

  const htmlString = makrdown2Html(content);

  return {
    props: {
      parsedMarkdown: {
        metadata,
        htmlString,
      },
    },
  };
};
