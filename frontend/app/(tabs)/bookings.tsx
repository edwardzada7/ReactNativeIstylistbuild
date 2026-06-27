import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';

const tabs = ['Upcoming', 'Past', 'Cancelled'];

const bookings = [
  {
    id: '1',
    providerName: 'Glamour Studio',
    service: 'Hair Coloring',
    date: '2025-07-25',
    time: '10:00 AM',
    status: 'confirmed',
    price: 120,
  },
  {
    id: '2',
    providerName: 'Elegance Spa',
    service: 'Full Body Massage',
    date: '2025-07-20',
    time: '2:00 PM',
    status: 'completed',
    price: 80,
  },
];

const statusColors = {
  pending: Colors.warning,
  confirmed: Colors.info,
  completed: Colors.success,
  cancelled: Colors.error,
};

export default function Bookings() {
  const [selectedTab, setSelectedTab] = useState('Upcoming');

  const renderTabButton = (tab: string) => (
    <TouchableOpacity
      key={tab}
      style={[
        styles.tabButton,
        selectedTab === tab && styles.tabButtonActive,
      ]}
      onPress={() => setSelectedTab(tab)}
    >
      <Text
        style={[
          styles.tabText,
          selectedTab === tab && styles.tabTextActive,
        ]}
      >
        {tab}
      </Text>
    </TouchableOpacity>
  );

  const renderBookingCard = ({ item }: { item: typeof bookings[0] }) => (
    <TouchableOpacity style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.providerIcon}>
          <Ionicons name="storefront" size={24} color={Colors.primary} />
        </View>
        <View style={styles.bookingInfo}>
          <Text style={styles.providerName}>{item.providerName}</Text>
          <Text style={styles.serviceName}>{item.service}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${statusColors[item.status]}20` },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: statusColors[item.status] },
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.date}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>{item.time}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="cash-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.detailText}>${item.price}</Text>
        </View>
      </View>

      {item.status === 'confirmed' && (
        <View style={styles.bookingActions}>
          <TouchableOpacity style={styles.actionButtonSecondary}>
            <Text style={styles.actionButtonTextSecondary}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonPrimary}>
            <Text style={styles.actionButtonTextPrimary}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'completed' && (
        <TouchableOpacity style={styles.reviewButton}>
          <Ionicons name="star-outline" size={16} color={Colors.primary} />
          <Text style={styles.reviewButtonText}>Leave a Review</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map(renderTabButton)}
      </View>

      {/* Bookings List */}
      <FlatList
        data={bookings.filter((b) => {
          if (selectedTab === 'Upcoming') return b.status === 'confirmed' || b.status === 'pending';
          if (selectedTab === 'Past') return b.status === 'completed';
          if (selectedTab === 'Cancelled') return b.status === 'cancelled';
          return true;
        })}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.bookingsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No bookings found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: 'bold',
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.text,
  },
  bookingsList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  bookingCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  serviceName: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bookingDetails: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButtonSecondary: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  actionButtonTextSecondary: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  actionButtonPrimary: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  actionButtonTextPrimary: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    backgroundColor: `${Colors.primary}20`,
    borderRadius: BorderRadius.sm,
  },
  reviewButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});