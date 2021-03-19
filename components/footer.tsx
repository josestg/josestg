import React from "react";
import { Divider, Flex, HStack, Link, Stack, Text } from "@chakra-ui/layout";

import { BaseLayout } from "./base-layout";

export const Footer: React.FC = () => {
  return (
    <Flex
      as="footer"
      mt="8"
      height="140px"
      alignItems="center"
      justifyContent="center"
    >
      <BaseLayout py="12">
        <Divider mb="8" orientation="horizontal" />
        <Stack spacing="2">
          <HStack spacing={[4, 6]} justify="center">
            <Link isExternal href={"https://github.com/josestg"}>
              Github
            </Link>
            <Link isExternal href={"https://linkedin.com/in/josestg"}>
              Linkedin
            </Link>
          </HStack>
          <Flex justify="center">
            <Text fontSize="sm">
              Copyright {new Date().getFullYear()} &#169;{" "}
              <Link href="/">josestg.com</Link>
            </Text>
          </Flex>
        </Stack>
      </BaseLayout>
    </Flex>
  );
};
