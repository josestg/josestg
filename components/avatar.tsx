import React from "react";
import { Box, Image } from "@chakra-ui/react";

interface Props {
  url: string;
}

export const Avatar: React.FC<Props> = ({ url }) => {
  return (
    <Box
      mr="3"
      padding="2px"
      rounded="full"
      background="linear-gradient(90deg, rgba(131,58,180,1) 0%, rgba(253,29,29,1) 50%, rgba(252,176,69,1) 100%)"
    >
      <Image
        w="40px"
        rounded="full"
        height="40px"
        src={url}
        borderColor="blue.500"
      />
    </Box>
  );
};
