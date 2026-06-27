import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, BorderRadius, FontSizes, Spacing, Shadows } from '../../constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  icon,
  disabled,
  style,
  ...props
}) => {
  const buttonStyle: ViewStyle[] = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style as ViewStyle,
  ];

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`text_${variant}`],
    styles[`text_${size}`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.text}
        />
      ) : (
        <>
          {icon}
          <Text style={textStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  primary: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  secondary: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  size_small: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 36,
  },
  size_medium: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  size_large: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    minHeight: 56,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  text_primary: {
    color: Colors.text,
  },
  text_secondary: {
    color: Colors.text,
  },
  text_outline: {
    color: Colors.primary,
  },
  text_ghost: {
    color: Colors.primary,
  },
  text_small: {
    fontSize: FontSizes.sm,
  },
  text_medium: {
    fontSize: FontSizes.md,
  },
  text_large: {
    fontSize: FontSizes.lg,
  },
});