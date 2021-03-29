import React from "react";
import useSWR from "swr";

import {
  Flex,
  HStack,
  Icon,
  Stat,
  StatNumber,
  StatLabel,
  Text,
  useColorModeValue,
  Progress,
  Stack,
  Spinner,
} from "@chakra-ui/react";
import { FaGithub, FaYoutube } from "react-icons/fa";
import { fetcher } from "../libs/fetcher";

export const GithubStats: React.FC = () => {
  return (
    <Flex
      flex="1"
      padding="4"
      rounded="md"
      boxShadow="md"
      bg={useColorModeValue("white", "gray.900")}
    >
      <Stat>
        <StatLabel>
          <HStack>
            <Icon as={FaGithub} />
            <Text>Github Account</Text>
          </HStack>
        </StatLabel>
        <StatNumber>
          <HStack my="2">
            <Stat>
              <StatLabel fontSize="xs">Followers</StatLabel>
              <StatNumber>100</StatNumber>
            </Stat>
            <Stat>
              <StatLabel fontSize="xs">Stars</StatLabel>
              <StatNumber>100</StatNumber>
            </Stat>

            <Stat>
              <StatLabel fontSize="xs">Repositories</StatLabel>
              <StatNumber>100</StatNumber>
            </Stat>
          </HStack>
        </StatNumber>
      </Stat>
    </Flex>
  );
};

export const YoutubeStats: React.FC = () => {
  return (
    <Flex
      flex="1"
      padding="4"
      rounded="md"
      boxShadow="md"
      bg={useColorModeValue("white", "gray.900")}
    >
      <Stat>
        <StatLabel>
          <HStack>
            <Icon as={FaYoutube} color="red.500" />
            <Text>Youtube Account</Text>
          </HStack>
        </StatLabel>
        <StatNumber>
          <HStack my="2">
            <Stat>
              <StatLabel fontSize="xs">Subscribers</StatLabel>
              <StatNumber>100</StatNumber>
            </Stat>
            <Stat>
              <StatLabel fontSize="xs">Views</StatLabel>
              <StatNumber>100</StatNumber>
            </Stat>

            <Stat>
              <StatLabel fontSize="xs">Videos</StatLabel>
              <StatNumber>100</StatNumber>
            </Stat>
          </HStack>
        </StatNumber>
      </Stat>
    </Flex>
  );
};

type LanguageStat = {
  name: string;
  persentase: number;
};

const colors = [
  "blue",
  "yellow",
  "pink",
  "cyan",
  "facebook",
  "gray",
  "orange",
  "green",
  "purple",
  "red",
  "teal",
  "whiteAlpha",
  "blackAlpha",
  "linkedin",
  "messenger",
  "whatsapp",
  "twitter",
  "telegram",
];

export const MostUsedProgrammingLanguagesStats: React.FC = () => {
  const { data } = useSWR<LanguageStat[]>("/api/github/languages", fetcher);

  if (!data) {
    return (
      <Flex
        flex="1.2"
        padding="4"
        rounded="md"
        boxShadow="md"
        direction="row"
        align="center"
        justify="center"
        height="max-content"
        mb={{ sm: 8, md: 0 }}
        bg={useColorModeValue("white", "gray.900")}
      >
        <Spinner size="lg" />
      </Flex>
    );
  }

  return (
    <Flex
      flex="1.2"
      padding="4"
      rounded="md"
      boxShadow="md"
      mx={{ sm: 0, md: 8 }}
      my={{ sm: 8, md: 0 }}
      bg={useColorModeValue("white", "gray.900")}
    >
      <Stat>
        <StatLabel textAlign="end">Most used Programming Languages</StatLabel>
        <StatNumber>
          <Stack py="2">
            {data.map(({ name, persentase }, index) => {
              return (
                <HStack key={name} fontSize="sm">
                  <Flex w="20%" justify="flex-end">
                    <Text>{name}</Text>
                  </Flex>
                  <Flex
                    flex="1"
                    align="center"
                    justify="space-between"
                    position="relative"
                  >
                    <Progress
                      value={persentase}
                      colorScheme={colors[index % colors.length]}
                      w="100%"
                      h="16px"
                      rounded="full"
                      max={100}
                    />
                    <Flex
                      fontSize="xs"
                      right="8px"
                      justify="flex-end"
                      position="absolute"
                    >
                      <Text>{persentase.toFixed(2)}%</Text>
                    </Flex>
                  </Flex>
                </HStack>
              );
            })}
          </Stack>
        </StatNumber>
      </Stat>
    </Flex>
  );
};
