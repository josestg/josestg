import React from "react";

import {
  Flex,
  Image,
  Link,
  Stack,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

import { FaGithub, FaLinkedinIn } from "react-icons/fa";
import {
  BaseLayout,
  LinkTextIcon,
  MostUsedProgrammingLanguagesStats,
} from "../components";

const AboutPage: React.FC = () => {
  return (
    <Flex direction="column" as="main">
      <Stack mt="4" spacing="16">
        <BaseLayout align="center">
          <IntroSection />
        </BaseLayout>

        <LanguageHistory />
      </Stack>
    </Flex>
  );
};

const LanguageHistory: React.FC = (props) => {
  return (
    <Stack px="4" {...props} bg={useColorModeValue("gray.50", "gray.800")}>
      <BaseLayout py="8">
        <Flex
          direction={{ sm: "column", md: "row" }}
          my="8"
          spacing="8"
          height="max-content"
        >
          <MostUsedProgrammingLanguagesStats />
          <Flex flex="1">
            <Stack spacing="2" fontSize="sm">
              <Text>
                Saat ini bahasa favorit saya adalah Go, tapi kadang saya
                menggunakan bahasa lain untuk menyesuaikan kebutuhan. Misalnya:
              </Text>

              <Text>
                Di frontend, saya suka menggunakan ReactJS dengan TypeScript
                atau JavaScript
              </Text>

              <Text>
                Ketika berkaitan dengan Machine Learning, saya biasanya lebih
                memilih Python.
              </Text>
              <Text>
                Sedangkan untuk Coding Interview atau Problem Solving saya
                memilih Java. Sebelumnya saya menggunakan Python, namum ketika
                terbiasa menggunakan Go saya malah suka yang strong typed.
              </Text>
            </Stack>
          </Flex>
        </Flex>
      </BaseLayout>
    </Stack>
  );
};

const IntroSection: React.FC = (props) => {
  return (
    <Flex direction={{ sm: "column", md: "row" }} align="center" py="8">
      <Image
        mb={{ sm: "8", md: "0" }}
        src="/images/profile.jpg"
        rounded="lg"
        height="324px"
        objectFit="cover"
        boxShadow="0 16px 40px rgba(214, 188, 250, 0.1)"
      />

      <Stack spacing="4" paddingX="4">
        <Text>
          Hello 👋, nama saya{" "}
          <Text as="span" fontWeight="bold" fontSize="lg">
            Jose Alfredo Sitanggang.
          </Text>{" "}
          Saya biasanya dipanggil{" "}
          <Text as="span" fontWeight="bold">
            Jose
          </Text>{" "}
          atau{" "}
          <Text as="span" fontStyle="italic" fontWeight="semibold">
            ho-ZAY (hoʊˈzeɪ)
          </Text>
        </Text>

        <Text>
          Saat ini saya bekerja sebagai{" "}
          <Link
            isExternal
            href="https://privy.id"
            fontWeight="semibold"
            color={useColorModeValue("red.500", "red.300")}
          >
            Backend Engineer di PrivyID
          </Link>{" "}
          yaitu perusahaan Tanda Tangan Digital. Disana saya bergabung di Core
          Team, fokus utama Core Team adalah mengembangkan dan memelihara
          internal API.
        </Text>

        <Stack spacing="1">
          <LinkTextIcon
            isExternal
            icon={FaGithub}
            text={"github.com/josestg"}
            href={"https://github.com/josestg"}
          />
          <LinkTextIcon
            isExternal
            icon={FaLinkedinIn}
            text={"linkedin.com/in/josestg"}
            href={"https://linkedin.com/in/josestg"}
          />
        </Stack>
      </Stack>
    </Flex>
  );
};

export default AboutPage;
