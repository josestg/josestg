import React from "react";
import { IconType } from "react-icons/lib";
import { HStack, Icon, Link, Text } from "@chakra-ui/react";

interface LinkTextIconProps {
  icon: IconType;
  text: string;
  href: string;
  isExternal?: boolean;
}

export const LinkTextIcon: React.FC<LinkTextIconProps> = ({
  icon,
  text,
  href,
  isExternal,
}) => {
  return (
    <Link href={href} isExternal={isExternal}>
      <HStack align="center" fontSize="sm">
        <Icon as={icon} />
        <Text>{text}</Text>
      </HStack>
    </Link>
  );
};
