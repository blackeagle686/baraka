# Software Requirements Specification (SRS)

## Baraka — Village Delivery SaaS Platform

| **Document Version** | 2.0 |
|---|---|
| **Date** | May 2026 |
| **Product** | Baraka Delivery Platform |
| **Domain** | Village Commerce & Delivery |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Users & Actors](#3-system-users--actors)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Database Design](#6-database-design)
7. [System Architecture](#7-system-architecture)
8. [API Endpoints](#8-api-endpoints)
9. [User Flows](#9-user-flows)
10. [Security Requirements](#10-security-requirements)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Future Enhancements](#12-future-enhancements)
13. [Glossary](#13-glossary)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the complete functional and non-functional requirements for **Baraka**, a SaaS delivery platform designed for villages and small towns. The platform connects three primary user groups — customers, local shops/restaurants, and delivery drivers ("طيارين") — through a web-based ordering and delivery management system.

### 1.2 Document Conventions

- `REQ-F-xxx` — Functional Requirement identifier
- `REQ-NF-xxx` — Non-Functional Requirement identifier
- `MUST` / `SHALL` — Absolute requirement
- `SHOULD` — Recommended requirement
- `MAY` — Optional requirement

### 1.3 Intended Audience

- Development team
- Project stakeholders
- QA / Test engineers
- System administrators
- Future maintainers

### 1.4 Product Scope

The system enables:

- **Customers** to browse nearby shops, view products, manage a cart, place orders, and track delivery status.
- **Shop Owners** to manage their shop profile, products, categories, working hours, and process incoming orders.
- **Delivery Drivers** to view available orders, accept delivery assignments, update delivery status, and manage delivery payments.
- **Administrators** to manage all users, shops, drivers, monitor orders, resolve disputes, handle reports, and view platform analytics.

The MVP is web-based only, with a mobile-first responsive UI and Arabic language support.

### 1.5 References

| Reference | Source |
|---|---|
| Django 6.0 Documentation | https://docs.djangoproject.com/en/6.0/ |
| Django REST Framework 3.14 | https://www.django-rest-framework.org/ |
| SimpleJWT 5.3 | https://django-rest-framework-simplejwt.readthedocs.io/ |
| Celery 5.3 | https://docs.celeryq.dev/ |
| Docker & Docker Compose | https://docs.docker.com/ |
| Vercel Platform | https://vercel.com/docs |

---

## 2. Overall Description

### 2.1 Product Perspective

Baraka is a **standalone web application** with a **Django REST API backend** and a **vanilla HTML/CSS/JS frontend**. It is self-contained and deployable via Docker Compose or Vercel.

### 2.2 Product Features (Summary)

- Role-based authentication & JWT token management
- Shop discovery, search, and category filtering
- Product management with stock tracking
- Shopping cart (persistent per user)
- Order placement with atomic stock deduction
- Order lifecycle management (Pending → Accepted → Preparing → On Delivery → Delivered / Cancelled)
- Driver assignment with delivery fee bidding (constrained)
- OTP-based delivery verification (customer → driver trust)
- OTP-based payment settlement (driver → shop owner trust)
- Dispute mediation system
- Driver rating by customers and shop owners
- Shop rating by customers (post-delivery only)
- Automated shop open/close notifications via Celery
- In-app notification system
- Admin dashboard (user mgmt, order monitoring, report management, analytics)

### 2.3 User Characteristics

| Role | Technical Skill | Frequency | Notes |
|---|---|---|---|
| Customer | Basic | Daily | Browse and order via phone |
| Shop Owner | Basic | Daily | Manage shop from mobile dashboard |
| Driver | Basic | Daily | Accept deliveries via mobile interface |
| Admin | Moderate | Weekly | Monitor and manage platform |

### 2.4 Operating Environment

- **Backend**: Python 3.11+, Django 6.0+, Gunicorn WSGI server
- **Frontend**: Any modern web browser (mobile-first responsive)
- **Database**: PostgreSQL (production) / SQLite (development)
- **Cache & Broker**: Redis (production) / LocalMemory (dev fallback)
- **Task Queue**: Celery 5.3+ with Redis broker
- **Containerization**: Docker & Docker Compose
- **Hosting Options**: Ubuntu VPS (Nginx + Gunicorn) or Vercel

### 2.5 Design & Implementation Constraints

1. **No external authentication providers** — phone-based local auth only
2. **Web-only MVP** — no native mobile app in v1
3. **Cash-on-delivery only** — no online payment gateway in v1
4. **Arabic-first UI** — all user-facing text in Arabic
5. **Offline not supported** — requires active internet connection
6. **No real-time WebSocket** — polling-based updates in v1

### 2.6 Assumptions & Dependencies

- Drivers have smartphones with internet access
- Shop owners check notifications regularly
- Customers have basic phone numbers (Egyptian format assumed)
- Redis is available in production for Celery task queue
- PostgreSQL is used in production; SQLite is adequate for single-user development

---

## 3. System Users & Actors

### 3.1 Actor Hierarchy

```
                     ┌──────────┐
                     │  ADMIN   │
                     │ (staff)  │
                     └────┬─────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                  │
   ┌────┴─────┐    ┌──────┴──────┐    ┌─────┴──────┐
   │ CUSTOMER │    │ SHOP_OWNER  │    │   DRIVER   │
   │          │    │             │    │  ("طيار")  │
   └──────────┘    └─────────────┘    └────────────┘
```

### 3.2 Actor Details

| Actor | Role Value | Approval Needed | Default Approved |
|---|---|---|---|
| Customer | `CUSTOMER` | No | Yes |
| Shop Owner | `SHOP_OWNER` | Yes (by Admin) | No |
| Driver | `DRIVER` | Yes (by Admin) | No |
| Admin | `ADMIN` | No (staff only) | Yes |

---

## 4. Functional Requirements

### 4.1 Authentication Module (REQ-F-AUTH)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-AUTH-01 | The system SHALL allow a user to register using a phone number as the primary identifier | Anonymous |
| REQ-F-AUTH-02 | The system SHALL require a password during registration | Anonymous |
| REQ-F-AUTH-03 | The system SHALL accept `name`, `location`, `latitude`, `longitude`, and `image` as optional registration fields | Anonymous |
| REQ-F-AUTH-04 | The system SHALL assign `CUSTOMER` role by default on registration | Anonymous |
| REQ-F-AUTH-05 | The system SHALL set `is_approved=false` automatically for `SHOP_OWNER` and `DRIVER` registrations | Anonymous |
| REQ-F-AUTH-06 | The system SHALL return JWT access + refresh tokens on successful login via phone + password | All |
| REQ-F-AUTH-07 | The system SHALL support token refresh via `POST /api/auth/token/refresh/` | All |
| REQ-F-AUTH-08 | The system SHALL return the authenticated user's profile on `GET /api/auth/profile/` | All |
| REQ-F-AUTH-09 | The system SHALL allow updating `name`, `location`, `image`, `latitude`, `longitude` on the profile endpoint | All |
| REQ-F-AUTH-10 | The system SHALL rate-limit login attempts (server-level, configurable) | System |

### 4.2 Shop Module (REQ-F-SHOP)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-SHOP-01 | The system SHALL list all shops with pagination (6 per page) | All |
| REQ-F-SHOP-02 | The system SHALL support search by shop name, description, or address | All |
| REQ-F-SHOP-03 | The system SHALL allow only `SHOP_OWNER` users to create a shop | Shop Owner |
| REQ-F-SHOP-04 | The system SHALL auto-assign the authenticated user as the shop owner on creation | Shop Owner |
| REQ-F-SHOP-05 | The system SHALL allow the shop owner to update their shop (name, description, image, address, hours) | Shop Owner |
| REQ-F-SHOP-06 | The system SHALL return the current user's shop via `GET /api/shops/my_shop/` | Shop Owner |
| REQ-F-SHOP-07 | The system SHALL allow setting `opening_time` and `closing_time` for automatic open/close alerts | Shop Owner |
| REQ-F-SHOP-08 | The system SHALL allow `is_open` manual toggling by the shop owner | Shop Owner |
| REQ-F-SHOP-09 | The system SHALL display average rating and total rating count for each shop | All |
| REQ-F-SHOP-10 | The system SHALL display all ratings with customer name and phone for each shop | All |
| REQ-F-SHOP-11 | The system SHALL allow only customers with a **delivered order** from the shop to rate (1-5 stars) | Customer |
| REQ-F-SHOP-12 | The system SHALL allow updating an existing rating (upsert) | Customer |
| REQ-F-SHOP-13 | The system SHALL provide a `rating_status` endpoint to check if the user can rate | Customer |

### 4.3 Product Module (REQ-F-PROD)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-PROD-01 | The system SHALL list all products with optional `shop_id` filter | All |
| REQ-F-PROD-02 | The system SHALL only allow `SHOP_OWNER` (who owns a shop) to create products | Shop Owner |
| REQ-F-PROD-03 | The system SHALL auto-assign the product to the owner's shop | Shop Owner |
| REQ-F-PROD-04 | The system SHALL require `name`, `price`; optional `description`, `image`, `category`, `quantity` | Shop Owner |
| REQ-F-PROD-05 | The system SHALL default product `quantity` to 10 and `available` to true | Shop Owner |
| REQ-F-PROD-06 | The system SHALL automatically set `available=false` when stock reaches 0 | System |
| REQ-F-PROD-07 | The system SHALL allow the shop owner to edit and delete their own products | Shop Owner |
| REQ-F-PROD-08 | The system SHALL list all categories (read-only for non-staff) | All |

### 4.4 Cart Module (REQ-F-CART)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-CART-01 | The system SHALL maintain one cart per authenticated user | Customer |
| REQ-F-CART-02 | The system SHALL allow adding a product with quantity to the cart | Customer |
| REQ-F-CART-03 | The system SHALL allow updating item quantity in the cart | Customer |
| REQ-F-CART-04 | The system SHALL allow removing an item from the cart | Customer |
| REQ-F-CART-05 | The system SHALL calculate and return the cart total | Customer |

### 4.5 Order Management (REQ-F-ORD)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-ORD-01 | The system SHALL only allow `CUSTOMER` role to place orders | Customer |
| REQ-F-ORD-02 | The system SHALL require `shop` ID, `address`, and `items` array (product ID + quantity) | Customer |
| REQ-F-ORD-03 | The system SHALL validate that all products belong to the specified shop | System |
| REQ-F-ORD-04 | The system SHALL validate product stock availability before placing the order | System |
| REQ-F-ORD-05 | The system SHALL execute order creation **atomically** within a database transaction | System |
| REQ-F-ORD-06 | The system SHALL deduct product quantities and update availability atomically | System |
| REQ-F-ORD-07 | The system SHALL bulk-insert order items in a single query | System |
| REQ-F-ORD-08 | The system SHALL generate a 4-digit `customer_otp` and `driver_otp` on order creation | System |
| REQ-F-ORD-09 | The system SHALL fire an async Celery task to notify drivers after order placement | System |
| REQ-F-ORD-10 | The system SHALL return orders filtered by role: customer sees own orders, shop owner sees shop orders, driver sees available + assigned | Role |
| REQ-F-ORD-11 | The system SHALL support order status transitions: PENDING → ACCEPTED → PREPARING → ON_DELIVERY → DELIVERED | Shop Owner/Driver |
| REQ-F-ORD-12 | The system SHALL allow cancellation at any status; cancelled orders SHALL restore product stock | Shop Owner/Customer |
| REQ-F-ORD-13 | The system SHALL **only allow drivers** to mark orders as DELIVERED | Driver |
| REQ-F-ORD-14 | The system SHALL **require `customer_otp`** when a driver marks an order as DELIVERED | Driver |
| REQ-F-ORD-15 | The system SHALL **only allow shop owners** to mark orders (not DELIVERED) | Shop Owner |
| REQ-F-ORD-16 | The system SHALL allow any role to raise a dispute with a reason | All |
| REQ-F-ORD-17 | The system SHALL set `dispute_status=PENDING` on dispute creation | All |

### 4.6 Driver Module (REQ-F-DRV)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-DRV-01 | The system SHALL show all unassigned orders (PENDING/ACCEPTED/PREPARING) to drivers | Driver |
| REQ-F-DRV-02 | The system SHALL allow a driver to accept an unassigned order via `accept_delivery` | Driver |
| REQ-F-DRV-03 | The system SHALL require a `delivery_price` (default 15 EGP, min 15 EGP, max 2% of order total) | Driver |
| REQ-F-DRV-04 | The system SHALL prevent double-assignment (one driver per order) | System |
| REQ-F-DRV-05 | The system SHALL show assigned orders to the assigned driver | Driver |
| REQ-F-DRV-06 | The system SHALL allow the shop owner to confirm payment received via `confirm_payment_received` | Shop Owner |
| REQ-F-DRV-07 | The system SHALL **require `driver_otp`** when confirming payment | Shop Owner |
| REQ-F-DRV-08 | The system SHALL allow rating a driver (1-5 stars) by both customer and shop owner after delivery | Customer/Shop Owner |
| REQ-F-DRV-09 | The system SHALL prevent duplicate ratings from the same rater on the same order (upsert) | System |

### 4.7 Notification Module (REQ-F-NOTIF)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-NOTIF-01 | The system SHALL create notifications for shop open/close time alerts | System (Celery) |
| REQ-F-NOTIF-02 | The system SHALL run a Celery Beat task every 60 seconds to check shop hours | System |
| REQ-F-NOTIF-03 | The system SHALL deduplicate alerts (one open + one close per shop per day) | System |
| REQ-F-NOTIF-04 | The system SHALL return notifications scoped to the authenticated user | All |
| REQ-F-NOTIF-05 | The system SHALL support marking a single notification as read | All |
| REQ-F-NOTIF-06 | The system SHALL support marking all notifications as read in one action | All |

### 4.8 Admin Dashboard (REQ-F-ADMIN)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-ADMIN-01 | The system SHALL display aggregate stats (total users by role, orders, shops, reports, pending approvals, blocked users) | Admin |
| REQ-F-ADMIN-02 | The system SHALL allow searching users by phone or name | Admin |
| REQ-F-ADMIN-03 | The system SHALL allow filtering users by role, approval status, and active status | Admin |
| REQ-F-ADMIN-04 | The system SHALL allow blocking/unblocking users (`is_active`) | Admin |
| REQ-F-ADMIN-05 | The system SHALL allow approving/rejecting users (`is_approved`) | Admin |
| REQ-F-ADMIN-06 | The system SHALL list all orders with search (by ID, customer phone, customer name) | Admin |
| REQ-F-ADMIN-07 | The system SHALL allow filtering all orders by status | Admin |
| REQ-F-ADMIN-08 | The system SHALL list all reports with search (subject, description, user phone) | Admin |
| REQ-F-ADMIN-09 | The system SHALL allow filtering reports by resolved status | Admin |
| REQ-F-ADMIN-10 | The system SHALL allow resolving reports with admin notes | Admin |
| REQ-F-ADMIN-11 | The system SHALL paginate all admin list views (15 items per page, configurable) | Admin |

### 4.9 Report Module (REQ-F-RPT)

| ID | Requirement | Actor |
|---|---|---|
| REQ-F-RPT-01 | The system SHALL allow any authenticated user to submit a report with subject and description | All |
| REQ-F-RPT-02 | The system SHALL auto-assign the authenticated user as the reporter | All |
| REQ-F-RPT-03 | The system SHALL allow admin to view, resolve, and add notes to reports | Admin |

---

## 5. Non-Functional Requirements

### 5.1 Performance (REQ-NF-PERF)

| ID | Requirement |
|---|---|
| REQ-NF-PERF-01 | API response time SHALL be < 2 seconds for 95% of requests under normal load |
| REQ-NF-PERF-02 | The system SHALL support at least 100 concurrent users initially |
| REQ-NF-PERF-03 | Order creation SHALL use bulk operations (`bulk_create`, `bulk_update`) to minimize DB round-trips |
| REQ-NF-PERF-04 | Order queries SHALL use `select_related` and `prefetch_related` to avoid N+1 queries |
| REQ-NF-PERF-05 | Product validation during order creation SHALL use a single bulk query (not per-item queries) |

### 5.2 Security (REQ-NF-SEC)

| ID | Requirement |
|---|---|
| REQ-NF-SEC-01 | All API endpoints except registration and login SHALL require JWT authentication |
| REQ-NF-SEC-02 | Passwords SHALL be hashed using Django's default hasher (PBKDF2) |
| REQ-NF-SEC-03 | The system SHALL enforce CSRF protection for session-based requests |
| REQ-NF-SEC-04 | OTP codes (customer_otp, driver_otp) SHALL be hidden from unauthorized users in API responses |
| REQ-NF-SEC-05 | Only the order customer SHALL see `customer_otp`; only the assigned driver SHALL see `driver_otp`; admins SHALL see both |
| REQ-NF-SEC-06 | The system SHALL enforce role-based access control on all write operations |
| REQ-NF-SEC-07 | Unapproved users (shop_owner, driver) SHALL be blocked from write operations via `IsApprovedOrReadOnly` permission |
| REQ-NF-SEC-08 | Input validation SHALL be performed on all user-supplied data |

### 5.3 Data Integrity (REQ-NF-DATA)

| ID | Requirement |
|---|---|
| REQ-NF-DATA-01 | Order placement and stock deduction SHALL occur in a single atomic database transaction |
| REQ-NF-DATA-02 | Cancelled orders SHALL restore product quantities |
| REQ-NF-DATA-03 | Driver ratings SHALL be unique per order per rater (upsert, not duplicate) |
| REQ-NF-DATA-04 | Shop ratings SHALL be unique per customer per shop (upsert) |

### 5.4 Scalability (REQ-NF-SCAL)

| ID | Requirement |
|---|---|
| REQ-NF-SCAL-01 | The system SHOULD support horizontal scaling via containerized deployment |
| REQ-NF-SCAL-02 | The Celery task queue SHALL handle notification dispatch asynchronously without blocking HTTP requests |
| REQ-NF-SCAL-03 | Redis caching SHALL be used for session storage and task brokering |
| REQ-NF-SCAL-04 | The database connection pool SHALL support up to 100 concurrent connections (`CONN_MAX_AGE=600`) |

### 5.5 Availability (REQ-NF-AVAIL)

| ID | Requirement |
|---|---|
| REQ-NF-AVAIL-01 | The system SHALL target 99% uptime |
| REQ-NF-AVAIL-02 | Docker health checks SHALL be configured for backend dependencies (PostgreSQL, Redis) |
| REQ-NF-AVAIL-03 | Gunicorn SHALL be configured with 4 workers and 2 threads for concurrent request handling |

### 5.6 Usability & Localization (REQ-NF-UI)

| ID | Requirement |
|---|---|
| REQ-NF-UI-01 | The frontend SHALL be mobile-first responsive |
| REQ-NF-UI-02 | All user-facing UI text SHALL be in Arabic |
| REQ-NF-UI-03 | Error messages in Arabic SHALL be provided for critical operations (OTP verification, stock issues, delivery price constraints) |
| REQ-NF-UI-04 | The UI SHALL use Bootstrap 5 for consistent responsive design |

### 5.7 Maintainability (REQ-NF-MAINT)

| ID | Requirement |
|---|---|
| REQ-NF-MAINT-01 | The codebase SHALL follow Django best practices with separation into apps (users, shops, orders, core) |
| REQ-NF-MAINT-02 | Celery tasks SHALL be defined per app (shops/tasks.py, orders/tasks.py) |
| REQ-NF-MAINT-03 | Database migrations SHALL be managed via Django's migration framework |

---

## 6. Database Design

### 6.1 Entity-Relationship Overview

```
User (1) ──< Shop (1) ──< Product
  │                        │
  │                        │
  ├──< Cart (1) ──< CartItem >── Product
  │
  ├──< Order >──< OrderItem >── Product
  │      │
  │      ├──> Shop
  │      ├──> User (driver)
  │      └──< DriverRating
  │
  ├──< ShopRating >── Shop
  │
  └──< Notification >── Shop
```

### 6.2 Table: `users_user`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| phone | VARCHAR(20) | UNIQUE, NOT NULL | Primary login identifier |
| password | VARCHAR(128) | NOT NULL | Hashed |
| name | VARCHAR(255) | NULLABLE | |
| location | VARCHAR(255) | NULLABLE | Text address |
| latitude | DECIMAL(9,6) | NULLABLE | |
| longitude | DECIMAL(9,6) | NULLABLE | |
| image | VARCHAR(100) | NULLABLE | File path |
| role | VARCHAR(20) | NOT NULL, Default: CUSTOMER | CUSTOMER, SHOP_OWNER, DRIVER, ADMIN |
| is_approved | BOOLEAN | Default: TRUE | FALSE for Shop Owner / Driver until admin approves |
| is_active | BOOLEAN | Default: TRUE | Admin can block users |
| date_joined | DATETIME | Auto | |
| last_login | DATETIME | NULLABLE | |
| is_staff | BOOLEAN | Default: FALSE | Django admin access |
| is_superuser | BOOLEAN | Default: FALSE | |

### 6.3 Table: `shops_shop`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| owner_id | BIGINT | FK → users_user.id, NOT NULL | |
| name | VARCHAR(255) | NOT NULL | |
| description | TEXT | NULLABLE | |
| image | VARCHAR(100) | NULLABLE | File path |
| address | VARCHAR(255) | NOT NULL | |
| latitude | DECIMAL(9,6) | NULLABLE | |
| longitude | DECIMAL(9,6) | NULLABLE | |
| is_open | BOOLEAN | Default: TRUE | Manual toggle |
| opening_time | TIME | NULLABLE | For auto-alerts |
| closing_time | TIME | NULLABLE | For auto-alerts |
| created_at | DATETIME | Auto | |

### 6.4 Table: `shops_category`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| name | VARCHAR(100) | NOT NULL | |

### 6.5 Table: `shops_product`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| shop_id | BIGINT | FK → shops_shop.id, NOT NULL | |
| category_id | BIGINT | FK → shops_category.id, NULLABLE | |
| name | VARCHAR(255) | NOT NULL | |
| description | TEXT | NULLABLE | |
| price | DECIMAL(10,2) | NOT NULL | |
| image | VARCHAR(100) | NULLABLE | File path |
| quantity | INTEGER | Default: 10 | Stock count |
| available | BOOLEAN | Default: TRUE | Auto-set to FALSE when quantity=0 |
| created_at | DATETIME | Auto | |

### 6.6 Table: `shops_shoppingrating`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| shop_id | BIGINT | FK → shops_shop.id, NOT NULL | |
| customer_id | BIGINT | FK → users_user.id, NOT NULL | |
| rating | SMALLINT | NOT NULL | 1-5 |
| review | TEXT | NULLABLE | |
| created_at | DATETIME | Auto | |
| **UNIQUE** | (shop_id, customer_id) | | One rating per customer per shop |

### 6.7 Table: `shops_notification`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| user_id | BIGINT | FK → users_user.id, NOT NULL | Recipient |
| shop_id | BIGINT | FK → shops_shop.id, NULLABLE | |
| title | VARCHAR(255) | NOT NULL | |
| message | TEXT | NOT NULL | |
| notification_type | VARCHAR(50) | Default: 'info' | shop_open_alert, shop_close_alert, info |
| is_read | BOOLEAN | Default: FALSE | |
| created_at | DATETIME | Auto | |

### 6.8 Table: `orders_cart`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| user_id | BIGINT | FK → users_user.id, UNIQUE, NOT NULL | One cart per user |
| created_at | DATETIME | Auto | |

### 6.9 Table: `orders_cartitem`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| cart_id | BIGINT | FK → orders_cart.id, NOT NULL | |
| product_id | BIGINT | FK → shops_product.id, NOT NULL | |
| quantity | INTEGER | Default: 1 | |

### 6.10 Table: `orders_order`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| customer_id | BIGINT | FK → users_user.id, NOT NULL | |
| shop_id | BIGINT | FK → shops_shop.id, NOT NULL | |
| driver_id | BIGINT | FK → users_user.id, NULLABLE | Assigned driver |
| total_price | DECIMAL(10,2) | NOT NULL | Computed at creation |
| delivery_price | DECIMAL(6,2) | Default: 0.00 | Set by driver on assignment |
| status | VARCHAR(20) | Default: PENDING | Enum: PENDING, ACCEPTED, PREPARING, ON_DELIVERY, DELIVERED, CANCELLED |
| address | TEXT | NOT NULL | |
| is_paid_to_shop | BOOLEAN | Default: FALSE | Settlement flag |
| customer_otp | VARCHAR(4) | Generated on create | Delivery verification code |
| driver_otp | VARCHAR(4) | Generated on create | Settlement verification code |
| dispute_status | VARCHAR(20) | Default: NONE | NONE, PENDING, RESOLVED |
| dispute_reason | TEXT | NULLABLE | |
| disputed_by_id | BIGINT | FK → users_user.id, NULLABLE | |
| created_at | DATETIME | Auto | |
| updated_at | DATETIME | Auto | |

### 6.11 Table: `orders_orderitem`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| order_id | BIGINT | FK → orders_order.id, NOT NULL | |
| product_id | BIGINT | FK → shops_product.id, NULLABLE | Nullable on product deletion |
| quantity | INTEGER | Default: 1 | |
| price | DECIMAL(10,2) | NOT NULL | Snapshot at order time |

### 6.12 Table: `orders_driverrating`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| order_id | BIGINT | FK → orders_order.id, NOT NULL | |
| driver_id | BIGINT | FK → users_user.id, NOT NULL | |
| rater_id | BIGINT | FK → users_user.id, NOT NULL | |
| rater_type | VARCHAR(20) | NOT NULL | CUSTOMER or SHOP_OWNER |
| rating | SMALLINT | NOT NULL | 1-5 |
| review | TEXT | NULLABLE | |
| created_at | DATETIME | Auto | |
| **UNIQUE** | (order_id, rater_id, rater_type) | | One rating per rater per order |

### 6.13 Table: `core_report`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | BIGINT | PK, Auto | |
| user_id | BIGINT | FK → users_user.id, NOT NULL | Reporter |
| subject | VARCHAR(255) | NOT NULL | |
| description | TEXT | NOT NULL | |
| is_resolved | BOOLEAN | Default: FALSE | |
| admin_notes | TEXT | NULLABLE | |
| created_at | DATETIME | Auto | |
| updated_at | DATETIME | Auto | |

---

## 7. System Architecture

### 7.1 High-Level Architecture

```
┌──────────────────────────────────────────────────────┐
│                    CLIENT LAYER                       │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  Browser │  │  Mobile  │  │  External API      │  │
│  │ (Web UI) │  │ (Future) │  │  Consumers (Future)│  │
│  └────┬─────┘  └──────────┘  └────────────────────┘  │
└───────┼──────────────────────────────────────────────┘
        │ HTTP / HTTPS
        ▼
┌──────────────────────────────────────────────────────┐
│              API GATEWAY / REVERSE PROXY              │
│               (Nginx / Vercel Rewrites)               │
└───────────────────────┬──────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                    │
│  ┌──────────────────────────────────────────────┐    │
│  │         Django REST Framework (DRF)          │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   │    │
│  │  │Users │ │Shops │ │Orders│ │ Core     │   │    │
│  │  │ App  │ │ App  │ │ App  │ │ Reports  │   │    │
│  │  └──────┘ └──────┘ └──────┘ └──────────┘   │    │
│  │  ┌──────────────────────────────────────┐   │    │
│  │  │      JWT Authentication Layer        │   │    │
│  │  └──────────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────┐   │    │
│  │  │      Role-Based Permission Layer     │   │    │
│  │  └──────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────┐  ┌────────────────────┐   │
│  │  Celery Workers      │  │  Celery Beat       │   │
│  │  - Order Notif.      │  │  - Shop Hours Check│   │
│  └──────────┬───────────┘  └──────────┬─────────┘   │
└─────────────┼─────────────────────────┼─────────────┘
              │                         │
              ▼                         ▼
┌──────────────────────────────────────────────────────┐
│                    DATA LAYER                         │
│  ┌────────────────────┐  ┌──────────────────────┐    │
│  │    PostgreSQL      │  │    Redis             │    │
│  │  (Primary Storage) │  │  (Cache + Broker)    │    │
│  └────────────────────┘  └──────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 7.2 Frontend Architecture

```
frontend/
├── html/
│   ├── index.html          # Home / shop listing
│   ├── cart.html           # Shopping cart
│   ├── auth/               # Login, Register
│   ├── shops/              # Shop detail, product grid
│   ├── profile/            # User profile, driver profile
│   └── admin/              # Admin dashboard pages
├── js/
│   ├── api.js              # Centralized API client (fetch wrapper)
│   ├── auth.js             # Auth logic (tokens, login, register)
│   ├── main.js             # App initialization
│   ├── index.js            # Home page logic
│   ├── shops.js            # Shop listing
│   ├── shop_list.js        # Shop list view
│   ├── shop_profile.js     # Shop detail page
│   ├── cart.js             # Cart management
│   ├── profile.js          # User profile
│   ├── driver_profile.js   # Driver dashboard
│   └── admin.js            # Admin dashboard
├── css/                    # Styling per page
└── images/                 # Static assets
```

### 7.3 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Backend Framework | Django | 6.0+ | HTTP handling, ORM, admin |
| API Framework | Django REST Framework | 3.14+ | RESTful API generation |
| Auth | SimpleJWT | 5.3+ | JWT token management |
| Database | PostgreSQL / SQLite | 15 / 3.x | Primary data store |
| Cache | Redis / LocMem | 5.0+ | Session cache, API caching |
| Task Queue | Celery | 5.3+ | Async background tasks |
| WSGI Server | Gunicorn | 21.2+ | Production web server |
| Reverse Proxy | Nginx | Latest | Static serving, routing |
| Frontend | Vanilla JS | ES6 | Dynamic UI |
| CSS Framework | Bootstrap | 5 | Responsive layout |
| Containerization | Docker | Latest | Deployment packaging |
| CI/CD | Docker Compose | 3.8 | Multi-service orchestration |

---

## 8. API Endpoints

### 8.1 Authentication (`/api/auth/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register/` | No | Register new user |
| POST | `/api/auth/login/` | No | Obtain JWT token pair |
| POST | `/api/auth/token/refresh/` | No | Refresh JWT access token |
| GET | `/api/auth/profile/` | Yes | Get current user profile |
| PATCH | `/api/auth/profile/` | Yes | Update profile fields |
| GET | `/api/auth/admin/users/` | Admin | List users (search, filter) |
| GET | `/api/auth/admin/users/{id}/` | Admin | Get user detail |
| PATCH | `/api/auth/admin/users/{id}/` | Admin | Update user (approve, block) |
| GET | `/api/auth/admin/stats/` | Admin | Dashboard statistics |

### 8.2 Shops (`/api/shops/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/shops/` | No | List shops (paginated, searchable) |
| POST | `/api/shops/` | Shop Owner | Create a new shop |
| GET | `/api/shops/{id}/` | No | Get shop detail (with products, ratings) |
| PUT/PATCH | `/api/shops/{id}/` | Owner | Update shop |
| DELETE | `/api/shops/{id}/` | Owner | Delete shop |
| GET | `/api/shops/my_shop/` | Shop Owner | Get current user's shop |
| POST | `/api/shops/{id}/rate/` | Customer | Rate a shop (post-delivery) |
| GET | `/api/shops/{id}/rating_status/` | Customer | Check rating eligibility |

### 8.3 Categories (`/api/categories/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/categories/` | No | List all categories |
| GET | `/api/categories/{id}/` | No | Get category detail |

### 8.4 Products (`/api/products/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/products/` | No | List products (filter by shop_id) |
| POST | `/api/products/` | Shop Owner | Create product |
| GET | `/api/products/{id}/` | No | Get product detail |
| PUT/PATCH | `/api/products/{id}/` | Owner | Update product |
| DELETE | `/api/products/{id}/` | Owner | Delete product |

### 8.5 Orders (`/api/orders/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/orders/` | Yes | List orders (role-filtered) |
| POST | `/api/orders/` | Customer | Place new order (atomic) |
| GET | `/api/orders/{id}/` | Yes | Get order detail |
| POST | `/api/orders/{id}/update_status/` | Owner/Driver | Transition order status |
| POST | `/api/orders/{id}/accept_delivery/` | Driver | Accept delivery assignment |
| POST | `/api/orders/{id}/confirm_payment_received/` | Shop Owner | Confirm cash settlement with driver OTP |
| POST | `/api/orders/{id}/raise_dispute/` | Yes | Raise a dispute on an order |
| POST | `/api/orders/{id}/rate_driver/` | Customer/Owner | Rate the driver (post-delivery) |
| GET | `/api/orders/{id}/driver_rating_status/` | Customer/Owner | Check driver rating eligibility |

### 8.6 Admin Orders (`/api/admin/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/orders/` | Admin | List all orders (search, filter by status) |

### 8.7 Notifications (`/api/notifications/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/notifications/` | Yes | List user's notifications |
| POST | `/api/notifications/{id}/mark_read/` | Yes | Mark notification as read |
| POST | `/api/notifications/mark_all_read/` | Yes | Mark all as read |

### 8.8 Reports (`/api/reports/`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/reports/` | Yes | Submit a report |
| GET | `/api/admin/reports/` | Admin | List all reports |
| GET | `/api/admin/reports/{id}/` | Admin | Get report detail |
| PATCH | `/api/admin/reports/{id}/` | Admin | Update report (resolve) |

---

## 9. User Flows

### 9.1 Customer Flow

```
                   ┌───────────────┐
                   │  Landing Page │
                   └───────┬───────┘
                           │
                    ┌──────▼──────┐
              ┌─────│   Logged    │─────┐
              │     │     In?     │     │
              │     └──────┬──────┘     │
              │            │ Yes        │ No
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │ Register │  │ Browse   │  │  Login   │
       └────┬─────┘  │ Shops    │  └────┬─────┘
            │        └────┬─────┘       │
            └─────────────┼─────────────┘
                          │
                    ┌─────▼──────┐
                    │  View Shop │
                    │  Products  │
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │ Add to Cart│
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Checkout  │
                    │ (Enter     │
                    │  Address)  │
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │ Place Order│
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │ Track Order│
                    │ + Provide  │
                    │   OTP to   │
                    │   Driver   │
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Rate Shop │
                    │  + Driver  │
                    └────────────┘
```

### 9.2 Shop Owner Flow

```
┌───────────┐
│   Login   │
└─────┬─────┘
      │
┌─────▼──────┐
│ Has Shop?  │
└─┬───────┬──┘
  │ No    │ Yes
  ▼       ▼
┌────┐ ┌───────────┐
│Create││ Dashboard │
│ Shop ││           │
└──┬───┘│ - Orders  │
   │    │ - Products│
   │    │ - Ratings │
   │    │ - Earnings│
   │    └─────┬─────┘
   │          │
   └──────────┘
              │
        ┌─────▼──────┐
        │ Manage      │
        │ Products    │
        │ (Add/Edit/  │
        │  Delete)    │
        └─────┬──────┘
              │
        ┌─────▼──────┐
        │ Process     │
        │ Orders      │
        │ (Accept →   │
        │  Prepare)   │
        └─────┬──────┘
              │
        ┌─────▼──────┐
        │ Confirm     │
        │ Payment     │
        │ (Driver OTP)│
        └────────────┘
```

### 9.3 Driver Flow

```
┌───────────┐
│   Login   │
└─────┬─────┘
      │
┌─────▼──────────┐
│ Driver Dashboard│
│ - Available     │
│   Orders        │
│ - My Deliveries │
│ - Earnings      │
└─────┬──────────┘
      │
┌─────▼──────┐
│ View        │
│ Available   │
│ Orders      │
└─────┬──────┘
      │
┌─────▼──────┐
│ Accept      │
│ Delivery    │
│ (Set Price) │
└─────┬──────┘
      │
┌─────▼──────┐
│ Pick Up     │
│ + Deliver   │
└─────┬──────┘
      │
┌─────▼──────┐
│ Mark        │
│ DELIVERED   │
│ (Customer   │
│  OTP)       │
└─────┬──────┘
      │
┌─────▼──────┐
│ Handover    │
│ Cash to     │
│ Shop Owner  │
│ (Provide    │
│  Driver OTP)│
└────────────┘
```

### 9.4 Admin Flow

```
┌───────────┐
│   Login   │
└─────┬─────┘
      │
┌─────▼──────────────┐
│   Admin Dashboard   │
│  ┌────────────────┐ │
│  │ Stats Overview │ │
│  └────────────────┘ │
│  ┌────────────────┐ │
│  │ User Management│ │
│  │ - Approve      │ │
│  │ - Block/Unblock│ │
│  └────────────────┘ │
│  ┌────────────────┐ │
│  │ Order Monitor   │ │
│  │ - Search/Filter│ │
│  └────────────────┘ │
│  ┌────────────────┐ │
│  │ Report Center   │ │
│  │ - View/Resolve │ │
│  └────────────────┘ │
└─────────────────────┘
```

---

## 10. Security Requirements

### 10.1 Authentication & Authorization

| Requirement | Implementation |
|---|---|
| Token-based auth | JWT (SimpleJWT) with 5-day access + refresh tokens |
| Role-based access | Custom DRF permissions: `IsAdminUserRole`, `IsOwnerOrReadOnly`, `IsApprovedUser`, `IsApprovedOrReadOnly` |
| Write protection | Unapproved users can only read, not write (except CUSTOMER) |
| OTP verification | 4-digit codes for delivery confirmation and payment settlement |
| OTP privacy | OTPs only exposed to relevant parties (customer sees customer_otp, driver sees driver_otp) |

### 10.2 Data Protection

| Concern | Measure |
|---|---|
| Password storage | Django's PBKDF2 hasher (default) |
| SQL Injection | Django ORM (parameterized queries) |
| XSS | Django template auto-escaping; vanilla JS avoids innerHTML where possible |
| CSRF | CORS middleware + JWT (stateless, no session cookie for API) |
| Input validation | DRF serializers with type coercion and validation |

### 10.3 Role-Based Access Control Matrix

| Action | Anonymous | Customer | Shop Owner | Driver | Admin |
|---|---|---|---|---|---|
| Register | ✅ | — | — | — | — |
| Login | ✅ | — | — | — | — |
| Browse shops | ✅ | ✅ | ✅ | ✅ | ✅ |
| View products | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create shop | ❌ | ❌ | ✅ | ❌ | ✅ |
| Manage own products | ❌ | ❌ | ✅ | ❌ | ✅ |
| Place order | ❌ | ✅ | ❌ | ❌ | ✅ |
| Update order status | ❌ | ❌ | ✅ (limited) | ✅ (DELIVERED only) | ✅ |
| Accept delivery | ❌ | ❌ | ❌ | ✅ | ✅ |
| Rate shop | ❌ | ✅ (post-delivery) | ❌ | ❌ | ❌ |
| Rate driver | ❌ | ✅ | ✅ | ❌ | ❌ |
| Raise dispute | ❌ | ✅ | ✅ | ✅ | ✅ |
| View admin dashboard | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ✅ |
| Resolve reports | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 11. Deployment Architecture

### 11.1 Docker Compose Topology

```
┌─────────────────────────────────────────────────────┐
│                   Docker Host                         │
│                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  PostgreSQL │  │   Redis    │  │  Frontend      │  │
│  │  :5432      │  │  :6379     │  │  (Nginx) :8080 │  │
│  └─────┬───────┘  └─────┬─────┘  └───────┬─────────┘  │
│        │                │                 │            │
│  ┌─────▼────────────────▼─────────────────▼─────────┐  │
│  │               Backend (Gunicorn)                   │  │
│  │               :8000                                │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │             Celery Worker                           │  │
│  │             (Async Tasks)                           │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 11.2 Vercel Deployment

```
Client ──► Vercel Edge Network
                │
        ┌───────┴───────┐
        │               │
   Static Files    Rewrite Rules
   (frontend/)     /api/* → backend/wsgi.py
                   /admin/* → backend/wsgi.py
```

### 11.3 Environment Configuration

| Variable | Description | Default |
|---|---|---|
| `DB_HOST` | PostgreSQL host | '' (uses SQLite) |
| `DB_NAME` | Database name | 'baraka' |
| `DB_USER` | Database user | 'postgres' |
| `DB_PASSWORD` | Database password | 'barakasecurepass' |
| `DB_PORT` | Database port | '5432' |
| `REDIS_URL` | Redis connection URL | 'redis://127.0.0.1:6379/1' |
| `CELERY_BROKER_URL` | Celery broker URL | 'redis://127.0.0.1:6379/1' |
| `CELERY_RESULT_BACKEND` | Celery result backend | 'redis://127.0.0.1:6379/1' |
| `DJANGO_SETTINGS_MODULE` | Django settings module | 'backend.settings' |
| `SECRET_KEY` | Django secret key | Dev-only default |

### 11.4 Celery Configuration

| Setting | Value |
|---|---|
| Task serialization | JSON |
| Result serialization | JSON |
| Timezone | UTC |
| Accepted content types | JSON |
| Beat schedule (shop hours) | Every 60 seconds |
| Task always eager (dev fallback) | True (when no Redis) |

---

## 12. Future Enhancements

### 12.1 Phase 2 (Near-Term)

| Feature | Description |
|---|---|
| Mobile App | Native Android/iOS applications |
| Live GPS Tracking | Real-time driver location on map |
| Real-time Chat | In-app messaging between customer, driver, and shop owner |
| Online Payments | Integration with Fawry, Vodafone Cash, or credit cards |
| AI Recommendations | Product and shop recommendations based on order history |
| Push Notifications | Firebase Cloud Messaging for mobile |

### 12.2 Phase 3 (Long-Term)

| Feature | Description |
|---|---|
| Multi-City Support | Expand to multiple villages/cities with regional admin |
| SaaS Subscriptions | Tiered pricing for shop owners (basic/premium) |
| Franchise System | Multi-branch shop management |
| AI Demand Prediction | Predict popular items and suggest stock levels |
| Route Optimization | Automated delivery route planning for drivers |
| Rating Analytics | Sentiment analysis on reviews |

---

## 13. Glossary

| Term | Definition |
|---|---|
| Baraka | Arabic for "blessing" — the platform name |
| طيار (Tayyar) | Arabic for "pilot" — delivery driver |
| Customer OTP | 4-digit code shown to the customer; the driver must enter this to confirm delivery |
| Driver OTP | 4-digit code shown to the driver; the shop owner must enter this to confirm payment settlement |
| IsApprovedOrReadOnly | DRF permission: unapproved users can read but not write |
| IsAdminUserRole | DRF permission: restricts access to ADMIN role or Django staff |
| Celery Beat | Scheduler that triggers periodic tasks (e.g., shop hours check) |
| Upsert | Update or insert — creates a record if none exists, otherwise updates |
| Atomic Transaction | Database operation that completes fully or not at all |
| N+1 Query Problem | Anti-pattern where N child queries are executed for N parent records (solved by select_related/prefetch_related) |
| Bulk Create/Update | Single-query batch operations for performance |
