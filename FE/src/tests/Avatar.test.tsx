import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '@/components/common/Avatar';

const userWithAvatar = { name: 'John Doe', avatarUrl: 'https://example.com/avatar.jpg' };
const userWithoutAvatar = { name: 'John Doe', avatarUrl: undefined };

describe('Avatar', () => {
  describe('with avatarUrl', () => {
    it('renders an <img> element', () => {
      render(<Avatar user={userWithAvatar} />);
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
    });

    it('sets src to the provided avatarUrl', () => {
      render(<Avatar user={userWithAvatar} />);
      expect(screen.getByRole('img')).toHaveAttribute('src', userWithAvatar.avatarUrl);
    });

    it('sets alt to the user name', () => {
      render(<Avatar user={userWithAvatar} />);
      expect(screen.getByRole('img')).toHaveAttribute('alt', 'John Doe');
    });
  });

  describe('without avatarUrl', () => {
    it('renders initials instead of an image', () => {
      render(<Avatar user={userWithoutAvatar} />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders correct initials for a single-word name', () => {
      render(<Avatar user={{ name: 'Alice' }} />);
      expect(screen.getByText('AA')).toBeInTheDocument();
    });

    it('uses first and last word for multi-word names', () => {
      render(<Avatar user={{ name: 'Mary Jane Watson' }} />);
      expect(screen.getByText('MW')).toBeInTheDocument();
    });
  });

  describe('size prop', () => {
    it('applies sm size class', () => {
      const { container } = render(<Avatar user={userWithoutAvatar} size="sm" />);
      expect(container.firstChild).toHaveClass('w-6', 'h-6');
    });

    it('applies md size class by default', () => {
      const { container } = render(<Avatar user={userWithoutAvatar} />);
      expect(container.firstChild).toHaveClass('w-8', 'h-8');
    });

    it('applies lg size class', () => {
      const { container } = render(<Avatar user={userWithoutAvatar} size="lg" />);
      expect(container.firstChild).toHaveClass('w-10', 'h-10');
    });
  });
});
