import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing, BorderRadius } from '../../src/constants/theme';

const filters = ['All', 'Hair', 'Makeup', 'Nails', 'Spa', 'Massage'];

const searchResults = [
  {
    id: '1',
    name: 'Luxe Hair Studio',
    category: 'Hair Styling',
    rating: 4.8,
    distance: '1.2 km',
    price: '$$',
  },
  {
    id: '2',
    name: 'Beauty Haven',
    category: 'Full Service Salon',
    rating: 4.9,
    distance: '2.5 km',
    price: '$$$',
  },
  {
    id: '3',
    name: 'Nail Art Paradise',
    category: 'Nail Art & Spa',
    rating: 4.7,
    distance: '0.8 km',
    price: '$',
  },
];

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      style={[
        styles.filterChip,
        selectedFilter === filter && styles.filterChipActive,
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      <Text
        style={[
          styles.filterText,
          selectedFilter === filter && styles.filterTextActive,
        ]}
      >
        {filter}
      </Text>
    </TouchableOpacity>
  );

  const renderResultCard = ({ item }: { item: typeof searchResults[0] }) => (
    <TouchableOpacity style={styles.resultCard}>
      <View style={styles.resultIcon}>
        <Ionicons name="storefront" size={32} color={Colors.primary} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultCategory}>{item.category}</Text>
        <View style={styles.resultMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={14} color={Colors.warning} />
            <Text style={styles.metaText}>{item.rating}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{item.distance}</Text>
          </View>
          <Text style={styles.priceText}>{item.price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services or providers..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="options-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {filters.map(renderFilterChip)}
      </ScrollView>

      {/* Results */}
      <FlatList
        data={searchResults}
        renderItem={renderResultCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
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
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  filterTextActive: {
    color: Colors.text,
  },
  resultsList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  resultName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  resultCategory: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  priceText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 'auto',
  },
});