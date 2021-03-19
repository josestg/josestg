import React from "react";
import styled from "@emotion/styled";
import { useRouter } from "next/router";
import {
  Flex,
  HStack,
  Text,
  Button,
  ButtonProps,
  IconButton,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";

import { BaseLayout } from "./base-layout";

export const Navbar: React.FC = () => {
  const { toggleColorMode } = useColorMode();

  const icon = useColorModeValue(<MoonIcon />, <SunIcon />);
  const bgColor = useColorModeValue("white", "gray.800");

  return (
    <Flex
      as="nav"
      justify="center"
      mb={8}
      top={0}
      zIndex={100}
      minH="60px"
      boxShadow="sm"
      position="sticky"
      bgColor={bgColor}
    >
      <BaseLayout justify="center">
        <Flex justify="space-between" align="center">
          <BrandLogo />
          <HStack spacing={[2, 8]}>
            <HStack>
              <NavLink to={"/"}>Posts</NavLink>
              <NavLink to={"/about"}>About</NavLink>
            </HStack>
            <HStack>
              <IconButton
                aria-label="toogle color theme"
                size="sm"
                varian="ghost"
                icon={icon}
                onClick={toggleColorMode}
                _focus={{ outline: "none" }}
              />
            </HStack>
          </HStack>
        </Flex>
      </BaseLayout>
    </Flex>
  );
};

export const NavLink: React.FC<NavLinkProps> = ({ children, to, ...rest }) => {
  const router = useRouter();

  const handleClick = () => router.push(to);
  const color = useColorModeValue("purple.500", "purple.200");

  return (
    <Button
      size="sm"
      variant="ghost"
      isActive={router.pathname === to}
      onClick={handleClick}
      _active={{
        color: color,
      }}
      {...rest}
    >
      {children}
    </Button>
  );
};

interface NavLinkProps extends ButtonProps {
  to: string;
}

export const BrandLogo: React.FC = () => {
  const router = useRouter();

  const handleClick = () => router.push("/");

  return (
    <Flex alignItems="flex-end" cursor="pointer" onClick={handleClick}>
      <Text fontSize={["sm", "md"]} fontWeight="bold">
        <Text as="span" fontWeight="bold" mr="2">
          {">"}
        </Text>
        josestg
      </Text>
      <UnderscoreCursor />
    </Flex>
  );
};

const UnderscoreCursor = styled.div`
  margin-left: 4px;
  margin-bottom: 2px;
  width: 15px;
  height: 4px;
  animation: bashBlinking 1.2s infinite;
  @keyframes bashBlinking {
    0% {
      background-color: #9f7aea;
    }
    49% {
      background-color: #9f7aea;
    }
    60% {
      background-color: transparent;
    }
    99% {
      background-color: transparent;
    }
    100% {
      background-color: #9f7aea;
    }
  }
`;
