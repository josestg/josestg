import fs from "fs";
import path from "path";
import React from "react";
import grayMatter from "gray-matter";
import { GetStaticProps } from "next";
import countReadingTime from "reading-time";
import { Flex, Stack } from "@chakra-ui/layout";

import { ContentMetadata } from "../types";
import { CONTENTS_DIRNAME } from "../config";
import { BaseLayout, ContentCard } from "../components";

export const IndexPage: React.FC<StaticProps> = ({ data }) => {
  return (
    <Flex direction="column" as="main">
      <Stack align="center">
        <BaseLayout height="300px">
          <Stack spacing={{ sm: "2", md: "4" }} width="94%" mx="auto">
            {data.map((metadata) => (
              <ContentCard key={metadata.slug} metadata={metadata} />
            ))}
          </Stack>
        </BaseLayout>
      </Stack>
    </Flex>
  );
};

export default IndexPage;

type StaticProps = {
  data: ContentMetadata[];
};

export const getStaticProps: GetStaticProps<StaticProps> = async () => {
  const contentDir = path.join(process.cwd(), CONTENTS_DIRNAME);
  const data = fs
    .readdirSync(contentDir, { encoding: "utf8" })
    .map((filename) => {
      const rawMarkdown = fs.readFileSync(path.join(contentDir, filename), {
        encoding: "utf8",
      });

      const { data: markdownMetadata, content } = grayMatter(rawMarkdown);

      const readingTime = countReadingTime(content);

      const metadata: ContentMetadata = {
        title: markdownMetadata.title,
        categories: markdownMetadata.categories,
        dateCreated: markdownMetadata.dateCreated,
        intro: markdownMetadata.intro,
        useLatex: markdownMetadata.useLatex,
        slug: filename.replace(".md", ""),
        readTime: readingTime.text,
      };

      return metadata;
    });

  return {
    props: {
      data,
    },
  };
};
