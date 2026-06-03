import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import jaMessages from "../src/translations/ja.json";
import "../src/styles/globals.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
    // AikiBoard は PC ファースト + レスポンシブ。PC を既定にしつつ tablet / SP も確認。
    viewport: {
      viewports: {
        pc: {
          name: "PC (1280px)",
          styles: { width: "1280px", height: "900px" },
        },
        tablet: {
          name: "Tablet (768px)",
          styles: { width: "768px", height: "1024px" },
        },
        sp: {
          name: "SP (390px)",
          styles: { width: "390px", height: "844px" },
        },
      },
      defaultViewport: "pc",
    },
  },
};

export default preview;
