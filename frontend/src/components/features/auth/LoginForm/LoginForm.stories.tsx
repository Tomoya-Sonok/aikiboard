import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoginForm } from "./LoginForm";

const meta = {
  title: "features/auth/LoginForm",
  component: LoginForm,
  parameters: { layout: "centered" },
  args: { onSubmit: () => {} },
  tags: ["autodocs"],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { isSubmitting: false },
};

export const Submitting: Story = {
  args: { isSubmitting: true },
};

export const WithServerError: Story = {
  args: {
    serverError: "メールアドレスまたはパスワードが正しくありません",
  },
};
