import React from "react";
import { Flex, FlexProps } from "@chakra-ui/layout";

export const BaseLayout: React.FC<FlexProps> = ({ children, ...rest }) => {
  return (
    <Flex
      direction="column"
      maxW="54rem"
      w="100%"
      mx="auto"
      px={[6, 4]}
      {...rest}
    >
      {children}
    </Flex>
  );
};
