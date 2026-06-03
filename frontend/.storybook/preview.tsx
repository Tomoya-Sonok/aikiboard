import type { Preview } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import jaMessages from "../src/translations/ja.json";
import "../src/styles/globals.css";

// TanStack Query を使うコンポーネント(DojoMasterSelect 等)の story 用。
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const preview: Preview = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="ja" messages={jaMessages}>
          <Story />
        </NextIntlClientProvider>
      </QueryClientProvider>
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
