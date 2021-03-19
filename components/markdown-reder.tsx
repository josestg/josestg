import styled from "@emotion/styled";
import { theme } from "@chakra-ui/react";

import { prismDarkTheme, prismLightTheme } from "../themes/prism";

interface Props {
  colorMode: "light" | "dark";
}

export const MarkdownRender = styled.div<Props>`
  ${({ colorMode }) =>
    colorMode === "dark" ? prismDarkTheme : prismLightTheme}

  p {
    font-family: inherit;
    margin: ${theme.space[6]} 0;
  }

  a {
    color: ${({ colorMode }) =>
      colorMode === "light" ? theme.colors.red[500] : theme.colors.yellow[300]};
    &:hover {
      text-decoration: underline;
    }
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: ${theme.fontWeights.medium};
    line-height: ${theme.lineHeights.shorter};
    margin: ${theme.space[10]} 0 ${theme.space[2]};
  }

  h1 {
    font-size: ${theme.fontSizes["3xl"]};
  }

  h2 {
    font-size: ${theme.fontSizes["2xl"]};
  }

  h3,
  h4,
  h5,
  h6 {
    font-size: ${theme.fontSizes.xl};
  }

  ul,
  ol {
    margin-left: ${theme.space[5]};
  }

  pre {
    width: 100%;
  }

  code {
    background-color: ${({ colorMode }) =>
      colorMode === "light"
        ? theme.colors.purple[100]
        : theme.colors.purple[900]};
    padding: 0 2px;
    border-radius: 4px;
  }
  img {
    width: 100%;
    object-fit: cover;
    margin: 0 auto;
  }

  /* FIGURE */
  .rehype-figure {
    border-radius: 10px;
    overflow: hidden;
    margin: 32px auto;

    border: 2px solid
      ${({ colorMode }) =>
        colorMode === "light"
          ? theme.colors.gray[200]
          : theme.colors.gray[700]};

    figcaption {
      text-align: center;
      font-style: italic;
      width: 100%;
      margin-bottom: 0;
      font-size: 0.8rem;
      padding: ${theme.space[2]};
      font-weight: ${theme.fontWeights.medium};

      color: ${({ colorMode }) =>
        colorMode === "light"
          ? theme.colors.gray[800]
          : theme.colors.gray[100]};
      background: ${({ colorMode }) =>
        colorMode === "light"
          ? theme.colors.gray[200]
          : theme.colors.gray[700]};
    }
  }

  table {
    position: relative;
    max-width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    margin: 24px auto;
    min-width: 80%;
    th {
      background-color: ${({ colorMode }) =>
        colorMode === "dark" ? theme.colors.gray[700] : theme.colors.gray[50]};
    }
    td,
    th {
      padding: 8px 12px;
      word-break: break-all;
      border: 1.8px solid
        ${({ colorMode }) =>
          colorMode === "dark"
            ? theme.colors.gray[600]
            : theme.colors.gray[300]};
    }
  }

  blockquote {
    position: relative;
    background-color: ${({ colorMode }) =>
      colorMode === "dark" ? theme.colors.gray[700] : theme.colors.purple[50]};
    border-radius: 5px;
    padding: 4px 0;
    margin: 0;
    margin-bottom: 28px;
    width: 98%;
    p {
      font-size: ${theme.fontSizes.sm};
      margin: auto 0;
      padding: 0 !important;
      align-items: center;
      margin-left: 15px;
    }
    ::before {
      content: "";
      background: ${({ colorMode }) =>
        colorMode === "dark"
          ? theme.colors.purple[300]
          : theme.colors.purple[400]};
      border-radius: 15px;
      height: 100%;
      left: 0;
      position: absolute;
      top: 0;
      width: 5px;
    }
  }
`;
