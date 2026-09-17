import type { Feed } from './api';

export const tabLabels: Record<Feed, string> = { top: 'Top', new: 'New', best: 'Best', ask: 'Ask HN', show: 'Show HN' };
export const feedInfo: Record<Feed, { title: string; description: string }> = {
  top: { title: 'The front page', description: 'What’s catching the community’s attention.' },
  new: { title: 'Fresh off the keyboard', description: 'The latest submissions, as they arrive.' },
  best: { title: 'Worth your time', description: 'The stories that stayed with the community.' },
  ask: { title: 'A good question', description: 'Questions, perspectives, and collective wisdom.' },
  show: { title: 'Made by the community', description: 'Side projects, big ideas, and things people built.' },
};
