import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Button, Input } from "../../src/components/common";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import {
  shopService,
  Product,
  ProviderInventory,
} from "../../src/services/shop.service";
import {
  Colors,
  FontSizes,
  Spacing,
  BorderRadius,
} from "../../src/constants/theme";
import {
  getShopCategoryBySlug,
  SHOP_CATEGORIES,
  ShopMainCategorySlug,
} from "../../src/constants/shopCategories";
import { formatCurrency } from "../../src/utils/currency";

type ShopView = "marketplace" | "my-products";
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://updatedistylistbeauty-marketplace-production.up.railway.app/api";
const PURCHASE_REDIRECT_URL = `${API_BASE_URL.replace(/\/api\/?$/, "")}/provider/shop`;

export default function ProviderShop() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [view, setView] = useState<ShopView>("marketplace");
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [marketplace, setMarketplace] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    image: "",
  });
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<ShopMainCategorySlug | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(
    null,
  );
  const [addingProductId, setAddingProductId] = useState<number | null>(null);
  const [inventory, setInventory] = useState<ProviderInventory[]>([]);
  const [purchaseProduct, setPurchaseProduct] = useState<Product | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [purchaseUrl, setPurchaseUrl] = useState<string | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const handledPurchaseRef = useRef(false);
  const [listingInventory, setListingInventory] = useState<ProviderInventory | null>(null);
  const [listingQuantity, setListingQuantity] = useState("1");
  const [listingPrice, setListingPrice] = useState("");

  const loadData = useCallback(async () => {
    if (!user?.auth_id) {
      setLoading(false);
      return;
    }
    try {
      const [mine, approved, ownedInventory] = await Promise.all([
        shopService.getProviderShopProducts(user.auth_id),
        shopService.getProducts(),
        shopService.getProviderInventory().catch((error) => {
          console.warn("[provider-shop] failed to load inventory", error);
          return [];
        }),
      ]);
      setMyProducts(mine);
      setMarketplace(approved);
      setInventory(ownedInventory);
    } catch (error: any) {
      console.error("[provider-shop] failed to load", error);
      Alert.alert(
        "Could not load shop",
        error?.friendlyMessage || error?.message || "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [user?.auth_id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const openEditor = (product?: Product) => {
    setEditing(product || null);
    setForm({
      name: product?.name || "",
      description: product?.description || "",
      price: product ? String(product.price) : "",
      stock: product ? String(product.stock) : "",
      image: product?.image_urls?.[0] || "",
    });
    setModalVisible(true);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow photo library access to add a product photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64)
      setForm((current) => ({
        ...current,
        image: `data:image/jpeg;base64,${asset.base64}`,
      }));
  };

  const saveProduct = async () => {
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (
      !form.name.trim() ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      Alert.alert(
        "Missing info",
        "Enter a product name, valid price, and stock quantity.",
      );
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        stock,
        image_urls: form.image ? [form.image] : undefined,
      };
      if (editing) await shopService.updateProduct(editing.id, input);
      else await shopService.createProduct(input);
      setModalVisible(false);
      await loadData();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.friendlyMessage ||
          error?.message ||
          "Could not save this product.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = (product: Product) =>
    Alert.alert("Delete Product", `Remove "${product.name}" from your shop?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await shopService.deleteProduct(product.id);
            setMyProducts((items) =>
              items.filter((item) => item.id !== product.id),
            );
          } catch (error: any) {
            Alert.alert(
              "Error",
              error?.friendlyMessage || "Could not delete this product.",
            );
          }
        },
      },
    ]);

  const handleAddToShop = async (product: Product) => {
    if (!user?.auth_id) {
      Alert.alert(
        "Sign in required",
        "Please sign in again before adding a product.",
      );
      return;
    }
    setAddingProductId(product.id);
    try {
      const result = await shopService.addProductToProviderShop(product);
      await loadData();
      Alert.alert(
        result.added ? "Added to My Shop" : "Already Added",
        result.added
          ? `${product.name} is now in My Products.`
          : `${product.name} is already in My Products.`,
      );
    } catch (error: any) {
      Alert.alert(
        "Could not add product",
        error?.friendlyMessage || error?.message || "Please try again.",
      );
    } finally {
      setAddingProductId(null);
    }
  };

  const handleBuyForShop = async () => {
    if (!purchaseProduct || !user?.email) return;
    const quantity = Number(purchaseQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      Alert.alert("Invalid quantity", "Choose a quantity greater than zero.");
      return;
    }
    if (
      !purchaseProduct.seller_listing_id ||
      purchaseProduct.provider_purchase_enabled !== true ||
      purchaseProduct.provider_purchase_price == null
    ) {
      Alert.alert(
        "Purchase unavailable",
        "This listing is not eligible for provider purchase.",
      );
      return;
    }
    setPurchaseBusy(true);
    try {
      const result = await shopService.initializeProviderPurchase({
        listing_id: purchaseProduct.seller_listing_id,
        quantity,
        email: user.email,
        redirect_url: PURCHASE_REDIRECT_URL,
      });
      if (!result?.authorization_url)
        throw new Error("Could not start provider checkout.");
      handledPurchaseRef.current = false;
      setPurchaseUrl(result.authorization_url);
    } catch (error: any) {
      Alert.alert(
        "Could not start purchase",
        error?.friendlyMessage ||
          error?.response?.data?.detail ||
          error?.message ||
          "Please try again.",
      );
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handlePurchaseRedirect = (request: { url: string }) => {
    if (
      !request.url.startsWith(PURCHASE_REDIRECT_URL) ||
      handledPurchaseRef.current
    )
      return true;
    handledPurchaseRef.current = true;
    const params = new URLSearchParams(request.url.split("?")[1] || "");
    const reference = params.get("reference") || params.get("trxref");
    if (!reference) {
      setPurchaseUrl(null);
      Alert.alert("Payment cancelled", "No funds were charged.");
      return false;
    }
    shopService
      .verifyProviderPurchase(reference)
      .then(async (result) => {
        if (result?.status === "success") {
          setPurchaseUrl(null);
          setPurchaseProduct(null);
          await loadData();
          Alert.alert(
            "Purchase successful",
            "The inventory is now yours and has not been listed publicly.",
          );
        } else
          Alert.alert(
            "Payment failed",
            result?.message || "The payment could not be verified.",
          );
      })
      .catch((error: any) =>
        Alert.alert(
          "Verification failed",
          error?.friendlyMessage ||
            error?.response?.data?.detail ||
            error?.message ||
            "Please try again.",
        ),
      );
    return false;
  };

  const handleListInventory = async () => {
    if (!listingInventory) return;
    const quantity = Number(listingQuantity);
    const price = Number(listingPrice);
    const available = listingInventory.quantity - (listingInventory.reserved_quantity || 0) - (listingInventory.quantity_allocated_to_listings || 0);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > available) { Alert.alert("Invalid quantity", `Choose between 1 and ${available} available units.`); return; }
    if (!Number.isFinite(price) || price <= 0) { Alert.alert("Invalid price", "Enter a resale price greater than zero."); return; }
    try {
      await shopService.listProviderInventory({ inventory_id: listingInventory.id, quantity, price });
      setListingInventory(null);
      await loadData();
      Alert.alert("Listed in My Shop", "The selected purchased inventory is now allocated for resale.");
    } catch (error: any) { Alert.alert("Could not list inventory", error?.friendlyMessage || error?.response?.data?.detail || error?.message || "Please try again."); }
  };

  const activeCategory = useMemo(
    () =>
      SHOP_CATEGORIES.find((category) => category.slug === selectedCategory) ??
      null,
    [selectedCategory],
  );

  const filteredMarketplace = useMemo(() => {
    const query = marketplaceSearch.trim().toLowerCase();

    return marketplace.filter((product) => {
      const matchesSearch =
        !query ||
        [product.name, product.description || ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const productCategory = getShopCategoryBySlug(
        product.main_category || product.category,
      );
      const matchesCategory =
        !selectedCategory || productCategory?.slug === selectedCategory;
      const matchesSubcategory =
        !selectedSubcategory ||
        (productCategory?.slug === selectedCategory &&
          product.subcategory?.toLowerCase() ===
            activeCategory?.subcategories
              .find((subcategory) => subcategory.id === selectedSubcategory)
              ?.name.toLowerCase());

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
  }, [
    activeCategory,
    marketplace,
    marketplaceSearch,
    selectedCategory,
    selectedSubcategory,
  ]);

  const products = view === "my-products" ? myProducts : filteredMarketplace;
  const myProductIds = useMemo(
    () => new Set(myProducts.map((product) => product.id)),
    [myProducts],
  );
  const hasMarketplaceFilters = Boolean(
    marketplaceSearch.trim() || selectedCategory || selectedSubcategory,
  );
  const clearMarketplaceFilters = () => {
    setMarketplaceSearch("");
    setSelectedCategory(null);
    setSelectedSubcategory(null);
  };

  const handleCategorySelection = (category: ShopMainCategorySlug | null) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
  };

  const renderProductCard = (product: Product) => {
    const alreadyAdded = myProductIds.has(product.id);
    const isMarketplaceListing = Boolean(product.isMarketplaceListing);

    return (
      <TouchableOpacity
        key={product.id}
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={() =>
          view === "my-products"
            ? isMarketplaceListing
              ? undefined
              : openEditor(product)
            : router.push(`/shop/${product.id}`)
        }
      >
        {product.image_urls?.[0] ? (
          <Image source={{ uri: product.image_urls[0] }} style={styles.image} />
        ) : (
          <View
            style={[
              styles.image,
              styles.imagePlaceholder,
              { backgroundColor: colors.background },
            ]}
          >
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {product.name}
          </Text>
          {isMarketplaceListing && (
            <Text
              style={[styles.source, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Source seller: {product.seller_name || "Marketplace seller"}
            </Text>
          )}
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {formatCurrency(product.price)} · {product.stock} in stock
          </Text>
          {view === "my-products" && (
            <Text
              style={[
                styles.status,
                {
                  color: isMarketplaceListing
                    ? colors.primary
                    : product.approved
                      ? Colors.success
                      : Colors.warning,
                },
              ]}
            >
              {isMarketplaceListing
                ? "Marketplace listing"
                : product.approved
                  ? "Live"
                  : "Pending Approval"}
            </Text>
          )}
        </View>
        {view === "my-products" ? (
          isMarketplaceListing ? null : (
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openEditor(product)}>
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteProduct(product)}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.marketplaceActions}>
            <TouchableOpacity
              style={[
                styles.addAction,
                { borderColor: alreadyAdded ? colors.border : colors.primary },
              ]}
              onPress={() => handleAddToShop(product)}
              disabled={alreadyAdded || addingProductId === product.id}
              accessibilityRole="button"
              accessibilityLabel={
                alreadyAdded
                  ? `${product.name} already added`
                  : `Add ${product.name} to My Shop`
              }
            >
              <Text
                style={[
                  styles.actionText,
                  { color: alreadyAdded ? colors.textMuted : colors.primary },
                ]}
              >
                {addingProductId === product.id
                  ? "Adding..."
                  : alreadyAdded
                    ? "Already Added"
                    : "Add to My Shop"}
              </Text>
            </TouchableOpacity>
            {product.provider_purchase_enabled === true &&
            product.provider_purchase_price != null ? (
              <TouchableOpacity
                style={[styles.buyAction, { borderColor: colors.primary }]}
                onPress={() => {
                  setPurchaseProduct(product);
                  setPurchaseQuantity("1");
                }}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${product.name} for My Shop`}
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>
                  Buy for My Shop
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Shop</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {view === "my-products"
              ? "Manage your products"
              : "Browse the marketplace"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {view === "my-products" && (
            <TouchableOpacity
              style={[
                styles.primaryAction,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => openEditor()}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.primaryActionText}>Add Product</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: colors.border }]}
            onPress={() => router.push("/(provider)/orders")}
          >
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>
              Orders
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.tabs}>
        {(["marketplace", "my-products"] as ShopView[]).map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.tab,
              { backgroundColor: colors.surface },
              view === option && { backgroundColor: colors.primary },
            ]}
            onPress={() => setView(option)}
          >
            <Text
              style={[
                styles.tabText,
                { color: colors.textSecondary },
                view === option && { color: "#fff" },
              ]}
            >
              {option === "my-products" ? "My Products" : "Marketplace"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {view === "marketplace" && (
        <View style={styles.marketplaceControls}>
          <View
            style={[styles.searchWrap, { backgroundColor: colors.surface }]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textMuted}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search marketplace"
              placeholderTextColor={colors.textMuted}
              value={marketplaceSearch}
              onChangeText={setMarketplaceSearch}
            />
            {marketplaceSearch ? (
              <TouchableOpacity
                onPress={() => setMarketplaceSearch("")}
                accessibilityRole="button"
                accessibilityLabel="Clear marketplace search"
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !selectedCategory && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => handleCategorySelection(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  !selectedCategory && { color: "#fff" },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {SHOP_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.slug}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  selectedCategory === category.slug && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => handleCategorySelection(category.slug)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    selectedCategory === category.slug && { color: "#fff" },
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {activeCategory ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <TouchableOpacity
                style={[
                  styles.subcategoryChip,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                  !selectedSubcategory && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => setSelectedSubcategory(null)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    !selectedSubcategory && { color: "#fff" },
                  ]}
                >
                  All in {activeCategory.name}
                </Text>
              </TouchableOpacity>
              {activeCategory.subcategories.map((subcategory) => (
                <TouchableOpacity
                  key={subcategory.id}
                  style={[
                    styles.subcategoryChip,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                    selectedSubcategory === subcategory.id && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setSelectedSubcategory(subcategory.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: colors.textSecondary },
                      selectedSubcategory === subcategory.id && {
                        color: "#fff",
                      },
                    ]}
                  >
                    {subcategory.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {hasMarketplaceFilters ? (
            <TouchableOpacity
              style={styles.clearFilters}
              onPress={clearMarketplaceFilters}
              accessibilityRole="button"
              accessibilityLabel="Clear marketplace filters"
            >
              <Ionicons
                name="refresh-outline"
                size={15}
                color={colors.primary}
              />
              <Text
                style={[styles.clearFiltersText, { color: colors.primary }]}
              >
                Clear filters
              </Text>
            </TouchableOpacity>
          ) : null}
          <View
            style={{
              borderWidth: 1,
              borderRadius: BorderRadius.md,
              padding: Spacing.md,
              marginTop: Spacing.sm,
              gap: 4,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: FontSizes.sm,
                fontWeight: "700",
              }}
            >
              Two ways to work with a product
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: FontSizes.xs,
                lineHeight: 18,
              }}
            >
              Add to My Shop creates a seller listing without buying inventory.
              You earn through the existing listing and order flow.
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: FontSizes.xs,
                lineHeight: 18,
              }}
            >
              Buy for My Shop purchases eligible official inventory outright.
              Purchased inventory stays private until you list it.
            </Text>
          </View>
        </View>
      )}
      {loading ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Loading shop...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="bag-handle-outline"
            size={34}
            color={colors.textMuted}
          />
          <Text style={{ color: colors.textSecondary }}>
            {view === "my-products"
              ? "No products yet."
              : hasMarketplaceFilters
                ? "No marketplace products match your filters."
                : "No approved products are available."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {products.map(renderProductCard)}
          {view === "my-products" && inventory.length > 0 ? (
            <View
              style={[
                styles.inventoryPanel,
                { backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.inventoryTitle, { color: colors.text }]}>
                Purchased Inventory
              </Text>
              {inventory.map((item) => (
                <View key={item.id} style={styles.inventoryRow}>
                  <Text style={[styles.inventoryName, { color: colors.text }]}>
                    {item.products?.name || "Product"} · {item.quantity} owned
                  </Text>
                  <Text
                    style={[
                      styles.inventoryMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Available:{" "}
                    {Math.max(
                      0,
                      item.quantity -
                        (item.reserved_quantity || 0) -
                        (item.quantity_allocated_to_listings || 0),
                    )}
                  </Text>
                  <TouchableOpacity style={[styles.buyAction, { borderColor: colors.primary }]} onPress={() => { setListingInventory(item); setListingQuantity("1"); setListingPrice(""); }}><Text style={[styles.actionText, { color: colors.primary }]}>List in My Shop</Text></TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
      <Modal
        visible={Boolean(purchaseProduct) && !purchaseUrl}
        transparent
        animationType="slide"
        onRequestClose={() => setPurchaseProduct(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.purchaseModal, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>
              Buy for My Shop
            </Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              {purchaseProduct?.name}
            </Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Source seller:{" "}
              {purchaseProduct?.seller_name || "iStylist Official"}
            </Text>
            <Text style={[styles.modalText, { color: colors.textSecondary }]}>
              Purchase price:{" "}
              {formatCurrency(purchaseProduct?.provider_purchase_price || 0)}
            </Text>
            <TextInput
              style={[
                styles.quantityInput,
                { color: colors.text, borderColor: colors.border },
              ]}
              value={purchaseQuantity}
              onChangeText={setPurchaseQuantity}
              keyboardType="number-pad"
              placeholder="Quantity"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.modalText, { color: colors.text }]}>
              Total:{" "}
              {formatCurrency(
                Number(purchaseQuantity || 0) *
                  Number(purchaseProduct?.provider_purchase_price || 0),
              )}
            </Text>
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setPurchaseProduct(null)}
                variant="outline"
              />
              <Button
                title="Pay with Paystack"
                onPress={handleBuyForShop}
                loading={purchaseBusy}
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(purchaseUrl)}
        animationType="slide"
        onRequestClose={() => setPurchaseUrl(null)}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPurchaseUrl(null)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              Provider Checkout
            </Text>
            <View style={{ width: 24 }} />
          </View>
          {purchaseUrl ? (
            <WebView
              source={{ uri: purchaseUrl }}
              onShouldStartLoadWithRequest={handlePurchaseRedirect}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
      <Modal visible={Boolean(listingInventory)} transparent animationType="slide" onRequestClose={() => setListingInventory(null)}><View style={styles.modalBackdrop}><View style={[styles.purchaseModal, { backgroundColor: colors.surface }]}><Text style={[styles.title, { color: colors.text }]}>List in My Shop</Text><Text style={[styles.modalText, { color: colors.textSecondary }]}>{listingInventory?.products?.name || "Purchased product"}</Text><Text style={[styles.modalText, { color: colors.textSecondary }]}>Choose the quantity and resale price.</Text><TextInput style={[styles.quantityInput, { color: colors.text, borderColor: colors.border }]} value={listingQuantity} onChangeText={setListingQuantity} keyboardType="number-pad" placeholder="Quantity" placeholderTextColor={colors.textMuted} /><TextInput style={[styles.quantityInput, { color: colors.text, borderColor: colors.border }]} value={listingPrice} onChangeText={setListingPrice} keyboardType="decimal-pad" placeholder="Resale price (NGN)" placeholderTextColor={colors.textMuted} /><View style={styles.modalActions}><Button title="Cancel" onPress={() => setListingInventory(null)} variant="outline" /><Button title="List Inventory" onPress={handleListInventory} /></View></View></View></Modal>
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              {editing ? "Edit Product" : "Add Product"}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <TouchableOpacity
              style={[styles.imagePicker, { borderColor: colors.border }]}
              onPress={pickImage}
            >
              {form.image ? (
                <Image
                  source={{ uri: form.image }}
                  style={styles.imagePickerPreview}
                />
              ) : (
                <Ionicons
                  name="camera-outline"
                  size={28}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>
            <Input
              label="Product Name"
              value={form.name}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, name: value }))
              }
            />
            <Input
              label="Description"
              value={form.description}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, description: value }))
              }
              multiline
            />
            <Input
              label="Price (NGN)"
              value={form.price}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, price: value }))
              }
              keyboardType="decimal-pad"
            />
            <Input
              label="Stock Quantity"
              value={form.stock}
              onChangeText={(value) =>
                setForm((current) => ({ ...current, stock: value }))
              }
              keyboardType="number-pad"
            />
            <Button
              title={editing ? "Save Changes" : "Add Product"}
              onPress={saveProduct}
              loading={saving}
              fullWidth
              size="large"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
  title: { fontSize: FontSizes.xl, fontWeight: "700" },
  subtitle: { fontSize: FontSizes.xs, marginTop: 2 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  primaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  primaryActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FontSizes.xs,
  },
  secondaryAction: {
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  secondaryActionText: { fontWeight: "600", fontSize: FontSizes.xs },
  tabs: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  tabText: { fontSize: FontSizes.sm, fontWeight: "600" },
  marketplaceControls: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    height: 40,
    marginBottom: Spacing.xs,
  },
  searchInput: { flex: 1, fontSize: FontSizes.sm },
  filterRow: { gap: Spacing.sm, paddingVertical: 4 },
  filterChip: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  subcategoryChip: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  filterChipText: { fontSize: FontSizes.xs, fontWeight: "600" },
  clearFilters: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingVertical: 4,
  },
  clearFiltersText: { fontSize: FontSizes.xs, fontWeight: "700" },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  image: { width: 56, height: 56, borderRadius: BorderRadius.sm },
  imagePlaceholder: { justifyContent: "center", alignItems: "center" },
  cardBody: { flex: 1 },
  source: { fontSize: FontSizes.xs, marginTop: 2 },
  name: { fontSize: FontSizes.sm, fontWeight: "700" },
  meta: { fontSize: FontSizes.xs, marginTop: 3 },
  status: { fontSize: FontSizes.xs, fontWeight: "700", marginTop: 4 },
  marketplaceActions: { gap: 5, alignItems: "stretch" },
  addAction: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  buyAction: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  actionText: {
    fontSize: FontSizes.xs,
    fontWeight: "700",
    textAlign: "center",
  },
  cardActions: { flexDirection: "row", gap: Spacing.sm },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  imagePicker: {
    height: 120,
    width: 120,
    alignSelf: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  imagePickerPreview: { width: "100%", height: "100%" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  purchaseModal: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  modalText: { fontSize: FontSizes.sm },
  quantityInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.sm },
  inventoryPanel: { marginTop: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.md },
  inventoryTitle: { fontSize: FontSizes.md, fontWeight: "700", marginBottom: Spacing.sm },
  inventoryRow: { paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: "#ddd" },
  inventoryName: { fontSize: FontSizes.sm, fontWeight: "600" },
  inventoryMeta: { fontSize: FontSizes.xs, marginTop: 2 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
  },
});
