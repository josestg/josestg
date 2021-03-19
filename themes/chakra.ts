import { mode } from "@chakra-ui/theme-tools";
import { extendTheme } from "@chakra-ui/react";

export default extendTheme({
  fonts: {
    mono: `'Menlo', monospace`,
    body: `Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"`,
  },
  colors: {
    black: "#16161D",
  },
  styles: {
    global: (props) => ({
      body: {
        fontFamily: "body",
        bg: mode("white", "gray.900")(props),
      },
      main: {
        minHeight: "100vh",
      },
    }),
  },
});
