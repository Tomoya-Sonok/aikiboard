import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Next.js modules for tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: "/",
    query: {},
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next-intl/navigation", () => {
  const redirect = vi.fn();
  const usePathname = vi.fn(() => "/");
  const useRouter = vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }));
  const Link = ({ children }: { children?: unknown }) => children ?? null;

  return {
    createNavigation: () => ({
      Link,
      redirect,
      usePathname,
      useRouter,
    }),
  };
});

// Default env vars for tests
process.env.NEXT_PUBLIC_API_URL = "http://localhost:8787";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
