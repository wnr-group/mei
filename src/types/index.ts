export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  shortDescription: string;
  description: string;
  craftType: string;
  categoryId: string;
  categoryName: string;
  inStock: boolean;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  subtitle: string;
};

export type Enquiry = {
  name: string;
  email: string;
  phone: string;
  occasion: string;
  budget: string;
  message: string;
};

export type Order = {
  id: string;
  items: OrderItem[];
  total: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  createdAt: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
};
