import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SignUpForm } from "./SignUpForm";

const meta = {
  title: "features/auth/SignUpForm",
  component: SignUpForm,
  parameters: { layout: "centered" },
  args: { onSubmit: () => {} },
  tags: ["autodocs"],
} satisfies Meta<typeof SignUpForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// 既定では 1 ステップ目(email / password)を表示。「次へ」で username ステップへ進む。
export const Default: Story = {
  args: { isSubmitting: false },
};

export const WithServerError: Story = {
  args: {
    serverError: "このユーザー名は既に使用されています",
  },
};
