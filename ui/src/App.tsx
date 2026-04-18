/**
 * SPDX-FileCopyrightText: 2026 Cédric Moulard / Kraftr
 * SPDX-License-Identifier: MIT
 */

import { useState, useEffect, createContext, useContext } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  useParams,
  Link,
  Navigate
} from 'react-router-dom';
import { 
  Menu, 
  ShoppingBag, 
  Search, 
  ArrowRight, 
  Home, 
  LayoutGrid, 
  ShoppingCart, 
  User, 
  Settings, 
  ArrowLeft, 
  Share, 
  CheckCircle, 
  Minus, 
  Plus, 
  ChevronRight, 
  Lock, 
  ShieldCheck, 
  LogOut,
  Package2,
  Bell,
  Verified,
  Headphones,
  TrendingUp,
  Trash2,
  X,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  status: string;
  category: string;
  image_url: string;
}

const API_BASE = '/api';

// --- Auth Context ---

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const AuthContext = createContext<{
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}>({ user: null, setUser: () => {} });

const useAuth = () => useContext(AuthContext);

// --- Cart Context ---

interface CartItem {
  product: Product;
  quantity: number;
}

const CartContext = createContext<{
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
}>({ items: [], addToCart: () => {}, removeFromCart: () => {}, updateQuantity: () => {}, clearCart: () => {}, itemCount: 0 });

const useCart = () => useContext(CartContext);

// --- Components ---

const TopAppBar = ({ title = "ATELIER", showBack = false, onBack = () => {} }: { title?: string, showBack?: boolean, onBack?: () => void }) => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { itemCount } = useCart();
  const isAdmin = user?.role === 'admin';
  return (
    <header className="fixed top-0 w-full z-50 glass-panel flex items-center justify-between px-6 h-16 shadow-sm">
      <div className="flex items-center gap-4">
        {showBack ? (
          <button onClick={onBack} className="text-slate-900 active:scale-95 transition-transform">
            <ArrowLeft size={24} />
          </button>
        ) : (
          <button className="text-slate-900 hover:opacity-80 transition-opacity">
            <Menu size={24} />
          </button>
        )}
        {showBack && <h1 className="editorial-font tracking-tighter uppercase font-bold text-slate-900 text-sm">{title}</h1>}
      </div>
      {!showBack && <div className="editorial-font tracking-[0.2em] font-light text-slate-900 text-xl uppercase font-bold">{title}</div>}
      <div className="flex items-center gap-4">
        {showBack && (
          <button className="text-slate-900 transition-opacity hover:opacity-80">
            <Share size={20} />
          </button>
        )}
        {user && !isAdmin && (
          <Link to="/cart" className="text-slate-900 relative transition-opacity hover:opacity-80">
            <ShoppingBag size={24} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary-container text-[10px] font-bold text-on-secondary-container">{itemCount}</span>
            )}
          </Link>
        )}
        {user && (
          <button onClick={() => { setUser(null); navigate('/'); }} className="text-slate-500 hover:text-slate-900 transition-colors" title="Log out">
            <LogOut size={20} />
          </button>
        )}
      </div>
    </header>
  );
};

const BottomNavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';

  const navItems = isAdmin
    ? [
        { icon: Settings, label: "Admin", path: "/admin" },
        { icon: User, label: "Profile", path: "/profile" },
      ]
    : [
        { icon: Home, label: "Home", path: "/home" },
        { icon: LayoutGrid, label: "Shop", path: "/home" },
        { icon: ShoppingCart, label: "Cart", path: "/cart" },
        { icon: User, label: "Profile", path: "/profile" },
      ];

  return (
    <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-2 glass-panel rounded-t-3xl z-50 shadow-[0_-8px_32px_rgba(25,28,30,0.06)]">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center px-4 py-2 transition-all duration-300 rounded-xl ${
              isActive 
                ? "bg-slate-900 text-white scale-95" 
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <item.icon size={20} fill={isActive ? "currentColor" : "none"} />
            <span className="font-body text-[10px] font-medium tracking-wide uppercase mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

// --- Screens ---

const LoginScreen = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid credentials');
        return;
      }
      const user = await res.json();
      setUser(user);
      navigate(user.role === 'admin' ? '/admin' : '/home');
    } catch {
      setError('Unable to connect to the server');
    }
  };

  const handleRegister = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Registration failed');
        return;
      }
      const user = await res.json();
      setUser(user);
      navigate('/home');
    } catch {
      setError('Unable to connect to the server');
    }
  };

  const switchMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col"
    >
      <TopAppBar />
      <main className="flex-grow flex items-center justify-center pt-24 pb-12 px-4 md:px-0">
        <div className="w-full max-w-[1200px] flex flex-col md:flex-row bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_-8px_32px_rgba(25,28,30,0.06)]">
          <div className="hidden md:flex md:w-1/2 relative min-h-[600px] bg-primary overflow-hidden">
            <img
              className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-overlay"
              src="https://picsum.photos/seed/atelier-login/1200/800"
              alt="Atelier Interior"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent"></div>
            <div className="relative z-10 p-12 flex flex-col justify-end h-full">
              <span className="editorial-font uppercase tracking-widest text-primary-fixed-dim text-sm mb-4">The Digital Atelier</span>
              <h1 className="editorial-font text-5xl font-extrabold text-white leading-tight tracking-tighter mb-6">
                Curated Precision <br/>For Modern Living.
              </h1>
              <p className="text-on-primary-container text-lg font-light leading-relaxed max-w-sm">
                Access your exclusive collections and personalized recommendations through our secure portal.
              </p>
            </div>
          </div>
          <div className="w-full md:w-1/2 p-8 md:p-16 lg:p-24 bg-surface-container-lowest">
            <div className="max-w-md mx-auto">
              <div className="mb-10">
                <h2 className="editorial-font text-3xl font-bold text-on-surface mb-2">{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="text-on-surface-variant font-body">{isRegistering ? 'Join the world of curated design.' : 'Continue your journey in the world of curated design.'}</p>
              </div>
              {error && (
                <div className="mb-6 p-4 bg-error-container rounded-lg text-on-error-container text-sm font-body">
                  {error}
                </div>
              )}
              <form className="space-y-6" onSubmit={isRegistering ? handleRegister : handleLogin}>
                {isRegistering && (
                  <div className="space-y-2">
                    <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">Full Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-4 rounded-lg bg-surface-container-high border-none focus:ring-0 focus:border-b-2 focus:border-primary transition-all font-body text-on-surface placeholder:text-outline/50" placeholder="Julian Reed" type="text" required/>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant ml-1">Email Address</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-4 rounded-lg bg-surface-container-high border-none focus:ring-0 focus:border-b-2 focus:border-primary transition-all font-body text-on-surface placeholder:text-outline/50" placeholder="john.doe@kraftr.tech" type="email" required/>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Password</label>
                  </div>
                  <div className="relative">
                    <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-4 rounded-lg bg-surface-container-high border-none focus:ring-0 focus:border-b-2 focus:border-primary transition-all font-body text-on-surface placeholder:text-outline/50" placeholder="••••••••" type="password" required/>
                  </div>
                </div>
                <button className="w-full primary-gradient text-white py-5 rounded-xl font-label text-xs font-bold uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-[0.98] transition-all" type="submit">
                  {isRegistering ? 'Create Account' : 'Sign In to Atelier'}
                </button>
              </form>
              <div className="mt-12 text-center">
                <p className="text-on-surface-variant font-body text-sm">
                  {isRegistering ? 'Already have an account?' : 'New to our collections?'}
                  <button onClick={switchMode} className="text-secondary font-bold hover:underline underline-offset-4 ml-1">{isRegistering ? 'Sign In' : 'Create an Account'}</button>
                </p>
              </div>
              <div className="mt-16 p-4 bg-surface-container-low rounded-xl flex items-start gap-4">
                <Lock className="text-secondary" size={20} />
                <p className="text-[11px] leading-relaxed text-on-surface-variant font-body">
                  All your data is encrypted with enterprise-grade standards. By continuing, you agree to our <span className="font-bold underline">Terms of Service</span> and <span className="font-bold underline">Privacy Policy</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="bg-surface-container-low pt-12 pb-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Verified, title: "Authentic Curation", desc: "Every piece in our collection is vetted by international design experts for quality and longevity." },
            { icon: ShieldCheck, title: "Private Secure Data", desc: "We utilize decentralized storage protocols to ensure your personal data remains strictly your own." },
            { icon: Headphones, title: "Concierge Support", desc: "Our design concierge is available 24/7 to assist with your architectural and styling needs." }
          ].map((item) => (
            <div key={item.title} className="p-8 bg-surface-container-lowest rounded-xl">
              <item.icon className="text-primary mb-4" size={24} />
              <h4 className="editorial-font font-bold mb-2">{item.title}</h4>
              <p className="text-on-surface-variant text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </footer>
    </motion.div>
  );
};

const HomeScreen = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Failed to fetch products:', err));
  }, []);

  const newArrivals = products.slice(0, 2);
  const featured = products.slice(2, 5);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="pt-16 pb-32"
    >
      <TopAppBar />
      <section className="px-6 py-8 bg-surface">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="text-outline" size={20} />
          </div>
          <input className="w-full h-14 pl-12 pr-4 bg-surface-container-high border-none rounded-xl focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest transition-all placeholder:text-outline/60 text-body-md" placeholder="Search curated collections..." type="text"/>
        </div>
      </section>
      <section className="px-6 mb-12">
        <div className="relative h-[480px] w-full rounded-xl overflow-hidden bg-primary-container">
          <img 
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-80" 
            src="https://picsum.photos/seed/atelier-hero/1200/800" 
            alt="Editorial fashion"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-10 left-8 right-8">
            <span className="inline-block px-3 py-1 bg-secondary-container text-on-secondary-container font-label text-[10px] font-bold tracking-[0.1em] uppercase rounded-full mb-4">
              Seasonal Exclusive
            </span>
            <h2 className="text-4xl md:text-5xl font-headline font-extrabold text-white tracking-tighter leading-none mb-4">
              The Winter<br/>Archive.
            </h2>
            <p className="text-on-primary-container text-body-md max-w-xs mb-8">
              Precision crafted garments designed for the modern minimalist. Limited production runs.
            </p>
            <button 
              onClick={() => navigate('/product/1')}
              className="px-8 py-4 bg-gradient-to-br from-primary to-primary-container text-white rounded-xl font-label text-xs font-bold tracking-widest uppercase hover:opacity-90 active:scale-95 transition-all"
            >
              Explore Collection
            </button>
          </div>
        </div>
      </section>
      <section className="mb-16">
        <div className="px-6 mb-6 flex justify-between items-end">
          <div>
            <h3 className="text-2xl font-headline font-bold text-primary tracking-tight">New Arrivals</h3>
            <p className="text-outline text-xs uppercase tracking-widest font-medium">Drop 04 / 24</p>
          </div>
          <button className="text-secondary text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
            View All <ArrowRight size={18} />
          </button>
        </div>
        <div className="flex overflow-x-auto gap-8 px-6 pb-4 no-scrollbar">
          {newArrivals.map((product) => (
            <div
              key={product.id}
              onClick={() => navigate(`/product/${product.id}`)}
              className="flex-none w-[80%] md:w-[400px] cursor-pointer"
            >
              <div className="relative aspect-[4/5] bg-surface-container-low rounded-xl overflow-hidden mb-4">
                <img
                  className="w-full h-full object-cover"
                  src={product.image_url}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-headline font-semibold text-lg text-primary">{product.name}</h4>
                  <p className="text-outline text-sm">{product.category}</p>
                </div>
                <span className="font-headline font-bold text-lg text-primary">{product.price.toLocaleString('fr-FR')} €</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="px-6 mb-16">
        <h3 className="text-2xl font-headline font-bold text-primary tracking-tight mb-8">Featured Staples</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featured[0] && (
            <div
              onClick={() => navigate(`/product/${featured[0].id}`)}
              className="col-span-2 row-span-2 relative rounded-xl overflow-hidden bg-surface-container-lowest group cursor-pointer"
            >
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                src={featured[0].image_url}
                alt={featured[0].name}
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <h4 className="font-headline text-xl font-bold mb-1">{featured[0].name}</h4>
                <p className="text-white/80 text-xs uppercase tracking-widest mb-4">{featured[0].category}</p>
                <button className="text-xs font-bold underline underline-offset-8 decoration-secondary">Shop Now</button>
              </div>
            </div>
          )}
          {featured.slice(1).map((product) => (
            <div
              key={product.id}
              onClick={() => navigate(`/product/${product.id}`)}
              className="bg-surface-container-lowest rounded-xl p-4 flex flex-col justify-between cursor-pointer"
            >
              <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-surface-container-low">
                <img
                  className="w-full h-full object-cover"
                  src={product.image_url}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <p className="text-outline text-[10px] uppercase font-bold tracking-tighter">{product.category}</p>
                <h4 className="text-sm font-semibold text-primary truncate">{product.name}</h4>
                <p className="text-primary font-bold mt-1">{product.price.toLocaleString('fr-FR')} €</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-6 p-8 rounded-xl bg-surface-container text-center">
        <h4 className="font-headline text-xl font-bold text-primary mb-2">Join the Atelier</h4>
        <p className="text-outline text-sm mb-6 max-w-xs mx-auto">Early access to drops, private previews, and editorial insights delivered weekly.</p>
        <div className="flex gap-2 max-w-md mx-auto">
          <input className="flex-1 bg-surface-container-lowest border-none rounded-xl px-4 text-sm focus:ring-1 focus:ring-primary" placeholder="Email address" type="email"/>
          <button className="px-6 py-3 bg-primary text-white rounded-xl font-label text-[10px] font-bold uppercase tracking-widest">Join</button>
        </div>
      </section>
      <BottomNavBar />
    </motion.div>
  );
};

const ProductDetailScreen = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addToCart, items: cartItems } = useCart();
  const inCart = product ? (cartItems.find(i => i.product.id === product.id)?.quantity || 0) : 0;
  const maxQty = product ? product.stock - inCart : 0;

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/products/${id}`)
      .then(res => res.json())
      .then(data => setProduct(data))
      .catch(err => console.error('Failed to fetch product:', err));
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-16 pb-32"
    >
      <TopAppBar title="Product Detail" showBack onBack={() => navigate(-1)} />
      <main className="max-w-screen-xl mx-auto">
        <section className="relative px-4 py-6 md:px-0">
          <div className="aspect-[4/5] md:aspect-[16/9] w-full overflow-hidden rounded-xl bg-surface-container-low shadow-sm">
            <img
              className="w-full h-full object-cover"
              src={product.image_url}
              alt={product.name}
              referrerPolicy="no-referrer"
            />
          </div>
        </section>
        <section className="px-6 space-y-8 mt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary font-label">{product.category}</span>
              <div className="h-px flex-1 bg-surface-container-high"></div>
            </div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tighter text-primary">{product.name}</h2>
                <p className="text-on-surface-variant font-medium mt-1">SKU: {product.sku}</p>
              </div>
              <div className="flex flex-col items-start md:items-end">
                <span className="text-3xl font-headline font-bold text-primary">{product.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                <span className={`text-sm font-medium rounded-full px-3 py-1 flex items-center gap-1 mt-2 ${product.stock > 0 ? 'text-tertiary-container bg-tertiary-fixed' : 'text-error bg-error-container'}`}>
                  <CheckCircle size={14} fill="currentColor" />
                  {product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 bg-surface-container-lowest rounded-xl p-8 space-y-6">
              <div>
                <h3 className="font-headline font-bold text-lg text-primary uppercase tracking-tight mb-4">Description</h3>
                <p className="text-on-surface-variant leading-relaxed font-body">
                  {product.description}
                </p>
              </div>
            </div>
            <div className="md:col-span-5 bg-surface-container-low rounded-xl p-8 space-y-8 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-headline font-bold text-lg text-primary uppercase tracking-tight">Select Quantity</h3>
                  <div className="flex items-center bg-surface-container-lowest rounded-xl w-fit p-1 shadow-sm">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center text-primary active:scale-90 transition-transform">
                      <Minus size={18} />
                    </button>
                    <span className="w-12 text-center font-bold font-headline text-lg">{quantity}</span>
                    <button onClick={() => setQuantity(Math.min(maxQty, quantity + 1))} disabled={quantity >= maxQty} className="w-10 h-10 flex items-center justify-center text-primary active:scale-90 transition-transform disabled:opacity-30">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { addToCart(product, quantity); navigate('/cart'); }}
                disabled={maxQty <= 0}
                className="w-full bg-gradient-to-br from-primary to-primary-container text-white h-16 rounded-xl font-label font-bold uppercase tracking-widest flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-xl shadow-primary/10 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="group-hover:translate-x-1 transition-transform" size={20} />
                Add to Cart
              </button>
            </div>
          </div>
        </section>
      </main>
      <BottomNavBar />
    </motion.div>
  );
};

const CartScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, removeFromCart, updateQuantity, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [billingSummary, setBillingSummary] = useState<{ subtotal: number; shipping: number; tax_rate: number; tax: number; total: number } | null>(null);

  useEffect(() => {
    if (items.length > 0) {
      fetch(`${API_BASE}/billing/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(i => ({ price: i.product.price, quantity: i.quantity })) }),
      })
        .then(r => r.json())
        .then(data => setBillingSummary(data))
        .catch(() => {});
    } else {
      setBillingSummary(null);
    }
  }, [items]);

  const subtotal = billingSummary?.subtotal ?? 0;
  const shipping = billingSummary?.shipping ?? 0;
  const taxRate = billingSummary?.tax_rate ?? 0;
  const tax = billingSummary?.tax ?? 0;
  const total = billingSummary?.total ?? 0;
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-24 pb-32 px-6 max-w-7xl mx-auto"
    >
      <TopAppBar />
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <ShoppingBag className="text-outline" size={64} />
          <h2 className="font-headline text-2xl font-bold text-primary">Your cart is empty</h2>
          <p className="text-on-surface-variant font-body">Discover our curated collections and add items to your cart.</p>
          <button onClick={() => navigate('/home')} className="primary-gradient text-white px-8 py-4 rounded-xl font-label text-xs font-bold uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-95 transition-all">
            Browse Collection
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            <header>
              <h2 className="font-headline text-3xl font-bold tracking-tight text-primary">Your Selection</h2>
              <p className="font-body text-on-surface-variant mt-2">{items.reduce((s, i) => s + i.quantity, 0)} object{items.reduce((s, i) => s + i.quantity, 0) > 1 ? 's' : ''} meticulously curated for your collection.</p>
            </header>
            <div className="space-y-6">
              {items.map((item) => (
                <div key={item.product.id} className="bg-surface-container-lowest rounded-xl p-6 flex flex-col sm:flex-row gap-6 items-center">
                  <Link to={`/product/${item.product.id}`} className="w-32 h-32 rounded-xl overflow-hidden bg-surface-container flex-shrink-0">
                    <img className="w-full h-full object-cover" src={item.product.image_url} alt={item.product.name} referrerPolicy="no-referrer" />
                  </Link>
                  <div className="flex-grow space-y-2 text-center sm:text-left">
                    <h3 className="font-headline font-semibold text-lg text-primary">{item.product.name}</h3>
                    <p className="text-sm text-on-surface-variant font-light tracking-wide">{item.product.category}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-4 pt-2">
                      <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-surface-container-high transition-colors">
                        <Minus size={14} />
                      </button>
                      <span className="font-headline font-bold text-primary">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stock} className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary hover:bg-surface-container-high transition-colors disabled:opacity-30">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="sm:text-right space-y-2">
                    <p className="font-headline font-bold text-xl text-primary">{fmt(item.product.price * item.quantity)} €</p>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-secondary text-xs uppercase tracking-widest font-bold hover:opacity-70 transition-opacity">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="bg-surface-container-low rounded-3xl p-8 sticky top-24">
              <h3 className="font-headline text-xl font-bold text-primary mb-8">Order Summary</h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-light">Subtotal</span>
                  <span className="text-primary font-semibold">{fmt(subtotal)} €</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-light">Shipping</span>
                  <span className="text-primary font-semibold">{fmt(shipping)} €</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-light">Tax ({Math.round(taxRate * 100)}%)</span>
                  <span className="text-primary font-semibold">{fmt(tax)} €</span>
                </div>
              </div>
              <div className="pt-8 mb-10">
                <div className="flex justify-between items-end">
                  <span className="font-headline text-sm uppercase tracking-[0.2em] font-bold text-on-surface-variant">Total</span>
                  <span className="font-headline text-3xl font-extrabold text-primary">{fmt(total)} €</span>
                </div>
              </div>
              {error && (
                <div className="p-4 bg-error-container rounded-lg text-on-error-container text-sm font-body whitespace-pre-line">
                  {error}
                </div>
              )}
              <button
                onClick={async () => {
                  if (!user) return;
                  setSubmitting(true);
                  setError('');
                  try {
                    const res = await fetch(`${API_BASE}/billing/checkout`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        user_id: user.id,
                        items: items.map(i => ({ product_id: i.product.id, quantity: i.quantity })),
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      if (Array.isArray(data.details)) {
                        setError(data.details.map((d: { name?: string; error: string }) => `${d.name || 'Product'}: ${d.error}`).join('\n'));
                      } else if (data.details) {
                        setError(`${data.error}: ${data.details}`);
                      } else {
                        setError(data.error || 'Checkout failed');
                      }
                      return;
                    }
                    clearCart();
                    setSuccess(true);
                  } catch {
                    setError('Unable to connect to the server');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || items.length === 0}
                className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-5 rounded-xl font-label text-sm font-bold uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Processing...' : 'Complete Purchase'}
              </button>
              <div className="mt-8 pt-8 space-y-4">
                <div className="flex gap-4 items-start">
                  <Verified className="text-secondary" size={20} />
                  <p className="text-xs text-on-surface-variant leading-relaxed">Genuine craftsmanship guarantee on all Atelier objects.</p>
                </div>
                <div className="flex gap-4 items-start">
                  <Package2 className="text-secondary" size={20} />
                  <p className="text-xs text-on-surface-variant leading-relaxed">Express insured delivery worldwide from our central workshop.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {success && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-tertiary-fixed flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="text-on-tertiary-fixed-variant" size={32} />
            </div>
            <h3 className="font-headline text-2xl font-extrabold text-primary mb-2">Order Confirmed</h3>
            <p className="text-on-surface-variant font-body mb-8">Your payment has been processed successfully. Thank you for your purchase!</p>
            <button
              onClick={() => { setSuccess(false); navigate('/home'); }}
              className="w-full primary-gradient text-white py-4 rounded-xl font-label text-xs font-bold uppercase tracking-widest shadow-lg hover:opacity-90 active:scale-95 transition-all"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
      <BottomNavBar />
    </motion.div>
  );
};

interface Order {
  id: string;
  total: number;
  created_at: string;
  items: { product_id: string; product_name: string; product_image_url: string; price: number; quantity: number }[];
}

const ProfileScreen = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      fetch(`${API_BASE}/billing/orders/${user.id}`)
        .then(r => r.json())
        .then(data => setOrders(data))
        .catch(() => {});
    }
  }, [user]);

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-24 pb-32 px-6 max-w-4xl mx-auto"
    >
      <TopAppBar />
      <section className="mb-12">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
          <div className="relative group">
            <div className="w-32 h-32 rounded-full overflow-hidden shadow-lg bg-surface-container-high border-4 border-surface-container-lowest">
              <img className="w-full h-full object-cover" src={`https://picsum.photos/seed/${user?.id || 'default'}/400/400`} alt={user?.name || 'User'} referrerPolicy="no-referrer" />
            </div>
            <button className="absolute bottom-1 right-1 bg-primary text-white p-2 rounded-full shadow-lg hover:scale-105 transition-transform">
              <Settings size={14} />
            </button>
          </div>
          <div className="text-center md:text-left flex-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
              <h2 className="text-3xl font-headline font-bold tracking-tight text-primary">{user?.name || 'Guest'}</h2>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-secondary-container/10 text-secondary text-[10px] font-bold uppercase tracking-widest border border-secondary/20 w-fit mx-auto md:mx-0">
                {user?.role === 'admin' ? 'Administrator' : 'Client'}
              </span>
            </div>
            <p className="text-on-surface-variant font-body text-sm">{user?.email}</p>
          </div>
        </div>
      </section>
      {user?.role !== 'admin' && (
        <div className="mb-12">
          <h3 className="text-2xl font-headline font-extrabold tracking-tight text-primary mb-6">Order History</h3>
          {orders.length === 0 ? (
            <p className="text-on-surface-variant font-body">No orders yet.</p>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <div key={order.id} className="bg-surface-container-lowest rounded-xl p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                    <div>
                      <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest">Order placed {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p className="text-[10px] text-outline font-mono mt-1">{order.id.slice(0, 8)}</p>
                    </div>
                    <p className="font-headline font-bold text-primary text-lg">{fmt(order.total)} €</p>
                  </div>
                  <div className="divide-y divide-surface-container">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container-high flex-shrink-0">
                          <img className="w-full h-full object-cover" src={item.product_image_url} alt={item.product_name} referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-headline font-semibold text-primary">{item.product_name}</p>
                          <p className="text-xs text-on-surface-variant">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-semibold text-primary">{fmt(item.price * item.quantity)} €</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="space-y-12 mb-20">
        <div className="flex flex-col md:flex-row gap-12">
          <div className="w-full md:w-1/3">
            <h4 className="font-headline font-extrabold text-2xl tracking-tight text-primary mb-2">Account Discovery</h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">Customize your editorial experience and manage how ATELIER curators tailor suggestions to your aesthetic.</p>
          </div>
          <div className="w-full md:w-2/3 grid grid-cols-1 gap-4">
            {[
              { icon: Bell, title: "Notification Preferences" },
              { icon: ShieldCheck, title: "Privacy & Security" }
            ].map((item) => (
              <div key={item.title} className="p-6 bg-surface-container-low rounded-xl flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <item.icon className="text-primary" size={20} />
                  <span className="font-headline font-semibold text-primary">{item.title}</span>
                </div>
                <ChevronRight className="text-outline-variant group-hover:translate-x-1 transition-transform" size={20} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-center border-t border-surface-container-highest pt-12">
        <button
          onClick={() => { setUser(null); navigate('/'); }}
          className="flex items-center gap-2 text-error font-headline font-bold uppercase tracking-[0.2em] text-sm hover:opacity-70 transition-opacity"
        >
          <LogOut size={20} />
          Log Out
        </button>
      </div>
      <BottomNavBar />
    </motion.div>
  );
};

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

const AdminScreen = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'users' | 'orders'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [allOrders, setAllOrders] = useState<(Order & { user_id: string; user_name: string; user_email: string })[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const emptyProduct: Product = {
    id: '', name: '', sku: '', description: '', price: 0, stock: 0,
    status: 'Active', category: '', image_url: '',
  };

  const fetchProducts = () => {
    fetch(`${API_BASE}/products?status=all`)
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Failed to fetch products:', err));
  };


  const fetchOrders = (userList: UserRecord[]) => {
    fetch(`${API_BASE}/billing/orders`)
      .then(res => res.json())
      .then((data: (Order & { user_id: string })[]) => {
        const enriched = data.map(order => {
          const u = userList.find(usr => usr.id === order.user_id);
          return { ...order, user_name: u?.name || 'Unknown', user_email: u?.email || '' };
        });
        setAllOrders(enriched);
      })
      .catch(err => console.error('Failed to fetch orders:', err));
  };

  useEffect(() => {
    fetchProducts();
    fetch(`${API_BASE}/users`)
      .then(res => res.json())
      .then((data: UserRecord[]) => { setUsers(data); fetchOrders(data); })
      .catch(err => console.error('Failed to fetch users:', err));
  }, []);

  const totalSales = allOrders.reduce((s, o) => s + o.total, 0);
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

  const handleSave = () => {
    if (!editingProduct) return;
    fetch(`${API_BASE}/products/${editingProduct.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProduct),
    })
      .then(res => res.json())
      .then(() => {
        setEditingProduct(null);
        fetchProducts();
      })
      .catch(err => console.error('Failed to update product:', err));
  };

  const handleCreate = () => {
    if (!editingProduct) return;
    fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingProduct),
    })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error); });
        return res.json();
      })
      .then(() => {
        setEditingProduct(null);
        setIsCreating(false);
        fetchProducts();
      })
      .catch(err => console.error('Failed to create product:', err));
  };

  const handleDelete = (productId: string) => {
    fetch(`${API_BASE}/products/${productId}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('Delete failed');
        fetchProducts();
      })
      .catch(err => console.error('Failed to delete product:', err));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="pt-16 pb-32"
    >
      <TopAppBar title="Admin Backoffice" />
      <div className="flex min-h-screen">
        <aside className="hidden md:flex flex-col h-[calc(100vh-64px)] w-80 bg-slate-50 p-8 fixed left-0 top-16 shadow-2xl z-40">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container-high">
              <img className="w-full h-full object-cover" src={`https://picsum.photos/seed/${currentUser?.id || 'admin'}/200/200`} alt={currentUser?.name || 'Admin'} referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-slate-900 text-lg">{currentUser?.name || 'Admin'}</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Administrator</p>
            </div>
          </div>
          <nav className="flex flex-col gap-y-4">
            <button onClick={() => setActiveTab('products')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer ${activeTab === 'products' ? 'bg-orange-50 text-orange-800 font-bold' : 'text-slate-600 hover:bg-slate-200'}`}>
              <Package2 size={20} />
              <span className="font-headline">Products</span>
            </button>
            <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer ${activeTab === 'orders' ? 'bg-orange-50 text-orange-800 font-bold' : 'text-slate-600 hover:bg-slate-200'}`}>
              <ShoppingBag size={20} />
              <span className="font-headline">Orders</span>
            </button>
            <button onClick={() => setActiveTab('users')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer ${activeTab === 'users' ? 'bg-orange-50 text-orange-800 font-bold' : 'text-slate-600 hover:bg-slate-200'}`}>
              <User size={20} />
              <span className="font-headline">Users</span>
            </button>
          </nav>
        </aside>
        <main className="flex-1 md:ml-80 px-6 py-8">
          {activeTab === 'orders' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 bg-surface-container-lowest">
                <h3 className="text-2xl font-headline font-extrabold text-primary tracking-tighter uppercase">Order Management</h3>
                <p className="text-sm text-on-surface-variant">{allOrders.length} order{allOrders.length !== 1 ? 's' : ''} — Total: {fmt(totalSales)} €</p>
              </div>
              {allOrders.length === 0 ? (
                <div className="px-8 py-12 text-center text-on-surface-variant">No orders yet.</div>
              ) : (
                <div className="divide-y divide-surface-container">
                  {allOrders.map((order) => (
                    <div key={order.id} className="px-8 py-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                        <div>
                          <p className="text-sm font-headline font-bold text-primary">{order.user_name}</p>
                          <p className="text-xs text-on-surface-variant">{order.user_email}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-headline font-bold text-primary">{fmt(order.total)} €</p>
                          <p className="text-[10px] text-outline uppercase tracking-widest">{new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-surface-container-low rounded-lg px-4 py-2">
                            <div className="w-8 h-8 rounded overflow-hidden bg-surface-container-high flex-shrink-0">
                              <img className="w-full h-full object-cover" src={item.product_image_url} alt={item.product_name} referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-primary">{item.product_name}</p>
                              <p className="text-[10px] text-on-surface-variant">x{item.quantity} — {fmt(item.price * item.quantity)} €</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'users' ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-8 py-6 bg-surface-container-lowest">
                <h3 className="text-2xl font-headline font-extrabold text-primary tracking-tighter uppercase">User Management</h3>
                <p className="text-sm text-on-surface-variant">View registered users and their roles.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container">
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">User</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Email</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Role</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high flex-shrink-0">
                              <img className="w-full h-full object-cover" src={`https://picsum.photos/seed/${u.id}/100/100`} alt={u.name} referrerPolicy="no-referrer" />
                            </div>
                            <span className="text-sm font-bold text-primary font-headline">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm text-on-surface-variant">{u.email}</td>
                        <td className="px-8 py-5">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'}`}>{u.role}</span>
                        </td>
                        <td className="px-8 py-5 text-sm text-on-surface-variant">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="md:col-span-2 relative overflow-hidden bg-white rounded-xl p-8 shadow-sm group">
              <div className="relative z-10">
                <p className="text-sm font-label uppercase tracking-widest text-on-primary-container mb-2">Total Sales</p>
                <h2 className="text-4xl font-headline font-extrabold text-primary mb-4 tracking-tighter">{fmt(totalSales)} €</h2>
                <div className="flex items-center gap-2 text-tertiary-container">
                  <TrendingUp size={14} />
                  <span className="text-sm font-semibold">{allOrders.length} order{allOrders.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm flex flex-col justify-between border-l-4 border-secondary">
              <div>
                <p className="text-sm font-label uppercase tracking-widest text-on-primary-container mb-2">Orders</p>
                <h2 className="text-4xl font-headline font-extrabold text-primary tracking-tighter">{allOrders.length}</h2>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-10">
            <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface-container-lowest">
              <div>
                <h3 className="text-2xl font-headline font-extrabold text-primary tracking-tighter uppercase">Inventory Management</h3>
                <p className="text-sm text-on-surface-variant">Manage your product catalog and stock levels.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={20} />
                  <input className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-primary text-sm w-full md:w-64 transition-all" placeholder="Search products..." type="text"/>
                </div>
                <button onClick={() => { setEditingProduct({ ...emptyProduct }); setIsCreating(true); }} className="primary-gradient text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg">
                  <Plus size={20} />
                  <span className="text-xs font-bold uppercase tracking-wider">Add New Product</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container">
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Product Details</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Stock Level</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Price</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Status</th>
                    <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.15em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {products.map((product) => {
                    const stockColor = product.stock === 0 ? 'bg-error' : product.stock > 100 ? 'bg-tertiary-fixed' : 'bg-secondary-container';
                    return (
                      <tr key={product.id} className="hover:bg-surface-container-lowest transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface-container-high flex-shrink-0">
                              <img className="w-full h-full object-cover" src={product.image_url} alt={product.name} referrerPolicy="no-referrer" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-primary font-headline">{product.name}</p>
                              <p className="text-xs text-on-surface-variant font-medium">SKU: {product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-semibold text-primary">{product.stock} Units</span>
                            <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div className={`h-full ${stockColor}`} style={{ width: product.stock > 100 ? '100%' : product.stock > 0 ? '25%' : '0%' }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-primary">{product.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                        <td className="px-8 py-5">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase ${product.status === 'Active' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}>{product.status}</span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditingProduct({ ...product })} className="p-2 hover:bg-surface-container-high rounded-lg transition-colors text-on-surface-variant">
                              <Settings size={18} />
                            </button>
                            <button onClick={() => handleDelete(product.id)} className="p-2 hover:bg-error-container hover:text-error rounded-lg transition-colors text-on-surface-variant">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </main>
      </div>
      {editingProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { setEditingProduct(null); setIsCreating(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-surface-container">
              <h3 className="font-headline font-extrabold text-xl text-primary uppercase tracking-tight">{isCreating ? 'New Product' : 'Edit Product'}</h3>
              <button onClick={() => { setEditingProduct(null); setIsCreating(false); }} className="p-2 hover:bg-surface-container-high rounded-lg transition-colors text-on-surface-variant">
                <X size={20} />
              </button>
            </div>
            <div className="px-8 py-6 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">Name</label>
                <input className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
              </div>
              {isCreating && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">SKU</label>
                  <input className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all" placeholder="e.g. PRD-001-BLK" value={editingProduct.sku} onChange={e => setEditingProduct({ ...editingProduct, sku: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">Price (€)</label>
                  <input type="number" step="0.01" className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">Stock</label>
                  <input type="number" className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all" value={editingProduct.stock} onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">Description</label>
                <textarea className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all resize-none h-24" value={editingProduct.description} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">Category</label>
                  <input className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all" value={editingProduct.category} onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">Status</label>
                  <select className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all" value={editingProduct.status} onChange={e => setEditingProduct({ ...editingProduct, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-outline ml-1">Image URL</label>
                <input className="w-full bg-surface-container-high border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all" value={editingProduct.image_url} onChange={e => setEditingProduct({ ...editingProduct, image_url: e.target.value })} />
              </div>
            </div>
            <div className="px-8 py-6 border-t border-surface-container flex justify-end gap-3">
              <button onClick={() => { setEditingProduct(null); setIsCreating(false); }} className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container-high transition-colors">
                Cancel
              </button>
              <button onClick={isCreating ? handleCreate : handleSave} className="px-6 py-3 rounded-xl primary-gradient text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg hover:opacity-90 active:scale-95 transition-all">
                <Save size={16} />
                {isCreating ? 'Create Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNavBar />
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = sessionStorage.getItem('atelier_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const fetchCart = async (userId: string) => {
    try {
      const cartRes = await fetch(`${API_BASE}/users/${userId}/cart`);
      const cartData: { product_id: string; quantity: number }[] = await cartRes.json();
      if (cartData.length === 0) { setCartItems([]); return; }
      const products: Product[] = await Promise.all(
        cartData.map(ci => fetch(`${API_BASE}/products/${ci.product_id}`).then(r => r.json()))
      );
      setCartItems(cartData.map((ci, i) => ({ product: products[i], quantity: ci.quantity })));
    } catch { setCartItems([]); }
  };

  const addToCart = async (product: Product, quantity = 1) => {
    if (!user) return;
    setCartItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { product, quantity }];
    });
    await fetch(`${API_BASE}/users/${user.id}/cart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, quantity }),
    });
  };

  const removeFromCart = async (productId: string) => {
    if (!user) return;
    setCartItems(prev => prev.filter(i => i.product.id !== productId));
    await fetch(`${API_BASE}/users/${user.id}/cart/${productId}`, { method: 'DELETE' });
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!user) return;
    if (quantity <= 0) { removeFromCart(productId); return; }
    setCartItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity } : i));
    await fetch(`${API_BASE}/users/${user.id}/cart/${productId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity }),
    });
  };

  const clearCart = async () => {
    if (!user) return;
    setCartItems([]);
    await fetch(`${API_BASE}/users/${user.id}/cart`, { method: 'DELETE' });
  };

  const itemCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const handleSetUser = (u: AuthUser | null) => {
    setUser(u);
    if (u) {
      sessionStorage.setItem('atelier_user', JSON.stringify(u));
      fetchCart(u.id);
    } else {
      sessionStorage.removeItem('atelier_user');
      setCartItems([]);
    }
  };

  useEffect(() => {
    if (user) fetchCart(user.id);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser: handleSetUser }}>
      <CartContext.Provider value={{ items: cartItems, addToCart, removeFromCart, updateQuantity, clearCart, itemCount }}>
      <BrowserRouter>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<LoginScreen />} />
            {user ? (
              <>
                <Route path="/profile" element={<ProfileScreen />} />
                {user.role === 'admin' ? (
                  <>
                    <Route path="/admin" element={<AdminScreen />} />
                    <Route path="*" element={<Navigate to="/admin" />} />
                  </>
                ) : (
                  <>
                    <Route path="/home" element={<HomeScreen />} />
                    <Route path="/product/:id" element={<ProductDetailScreen />} />
                    <Route path="/cart" element={<CartScreen />} />
                    <Route path="*" element={<Navigate to="/home" />} />
                  </>
                )}
              </>
            ) : (
              <Route path="*" element={<Navigate to="/" />} />
            )}
          </Routes>
        </AnimatePresence>
      </BrowserRouter>
      </CartContext.Provider>
    </AuthContext.Provider>
  );
}
