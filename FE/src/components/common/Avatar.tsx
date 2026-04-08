import type { User } from '@/types';

const SIZE = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
} as const;

const COLORS = [
  'bg-indigo-500', 'bg-pink-500', 'bg-amber-500',
  'bg-teal-500',  'bg-rose-500', 'bg-violet-500',
];

function initials(name: string): string {
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xff;
  return COLORS[hash % COLORS.length];
}

interface Props {
  user: Pick<User, 'name' | 'avatarUrl'>;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ user, size = 'md' }: Props) {
  const sizeClass = SIZE[size];

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} ${colorFor(user.name)} inline-flex items-center justify-center rounded-full font-medium text-white`}
    >
      {initials(user.name)}
    </span>
  );
}
