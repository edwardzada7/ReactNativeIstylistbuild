import { Alert } from 'react-native';

/**
 * Shared "Block this person?" confirmation, so the feed, comments and chat all
 * ask the same question. Runs `onBlock` only if the user confirms; it reports
 * its own success/failure to the user.
 */
export function confirmBlock(
  name: string | null | undefined,
  onBlock: () => Promise<void>
) {
  const label = name && name.trim() ? name.trim() : 'this user';
  Alert.alert(
    `Block ${label}?`,
    "You won't see their posts, comments or messages. You can unblock them any time in Settings > Blocked Users.",
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          onBlock()
            .then(() => Alert.alert('User blocked', `${label === 'this user' ? 'This user' : label} has been blocked.`))
            .catch((err: any) =>
              Alert.alert('Could not block', err?.friendlyMessage || err?.message || 'Please try again in a moment.')
            );
        },
      },
    ]
  );
}
