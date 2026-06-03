import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta = {
  title: "shared/Input",
  component: Input,
  parameters: { layout: "centered" },
  args: { label: "ボード名", placeholder: "例: 一般稽古" },
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { label: "URL", hint: "英小文字・数字・ハイフンが使えます" },
};

export const WithError: Story = {
  args: { label: "URL", error: "この URL は既に使われています" },
};
