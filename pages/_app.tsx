import React from "react";
import { AppProps } from "next/app";
import { ChakraProvider } from "@chakra-ui/react";

import chakraTheme from "../themes/chakra";
import { Footer, Navbar } from "../components";

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <ChakraProvider theme={chakraTheme}>
      <Navbar />
      <Component {...pageProps} />
      <Footer />
    </ChakraProvider>
  );
};

export default App;
