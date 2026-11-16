import type { Framework, FixSnippet } from './types';

// Patchlane fix library: for each fix family, the defensive server-side control written for each
// supported framework. Findings point here through their rule id (see fixKeyForRule below).
// Snippets are plain ASCII, use one fictional domain (orders, refunds, invoices) and are meant to be
// pasted into the developer's own API. They show fixes only, never how to exploit a weakness.

export type FixKey =
  | 'ownership'
  | 'require-auth'
  | 'require-scope'
  | 'response-allowlist'
  | 'input-allowlist'
  | 'page-limit'
  | 'upload-limit'
  | 'rate-limit'
  | 'idempotency'
  | 'ssrf-guard'
  | 'path-guard'
  | 'error-handler'
  | 'security-headers'
  | 'cors-allowlist'
  | 'cookie-flags'
  | 'jwt-verify'
  | 'agent-approval'
  | 'prompt-guard'
  | 'output-encoding';

export const FIX_TITLE: Record<FixKey, string> = {
  ownership: 'Check ownership on the server',
  'require-auth': 'Require authentication by default',
  'require-scope': 'Require the right scope or role on each route',
  'response-allowlist': 'Return only allow-listed fields',
  'input-allowlist': 'Accept only allow-listed input fields',
  'page-limit': 'Cap the page size and paginate with a cursor',
  'upload-limit': 'Limit upload size and file types',
  'rate-limit': 'Rate limit per user and per IP',
  idempotency: 'Require an Idempotency-Key on money-moving calls',
  'ssrf-guard': 'Guard server-side fetches of user-supplied URLs',
  'path-guard': 'Keep file paths inside a fixed directory',
  'error-handler': 'Return generic errors with a correlation id',
  'security-headers': 'Send security headers and refuse plain HTTP',
  'cors-allowlist': 'Allow CORS only from a fixed list of origins',
  'cookie-flags': 'Set Secure, HttpOnly and SameSite on session cookies',
  'jwt-verify': 'Verify JWTs with a pinned algorithm, issuer and audience',
  'agent-approval': 'Hold agent actions for human approval',
  'prompt-guard': 'Limit and redact what reaches the model',
  'output-encoding': 'Treat model output as untrusted when rendering it',
};

type Language = 'javascript' | 'python' | 'php' | 'java';

const LANGUAGE: Record<Framework, Language> = {
  express: 'javascript',
  fastapi: 'python',
  django: 'python',
  laravel: 'php',
  spring: 'java',
};

interface Draft {
  code: string;
  note?: string;
}

/** Turns one draft per framework into finished snippets: language filled in, outer blank lines trimmed. */
function family(drafts: Record<Framework, Draft>): Record<Framework, FixSnippet> {
  const out = {} as Record<Framework, FixSnippet>;
  for (const framework of Object.keys(drafts) as Framework[]) {
    const { code, note } = drafts[framework];
    const snippet: FixSnippet = { framework, language: LANGUAGE[framework], code: code.replace(/^\n+/, '').trimEnd() };
    if (note) snippet.note = note;
    out[framework] = snippet;
  }
  return out;
}

export const FIXES: Record<FixKey, Record<Framework, FixSnippet>> = {
  // ---------- API1: object level authorization ----------
  ownership: family({
    express: {
      note: 'Uses node-postgres (pg); the same owner_id condition applies with any ORM or query builder.',
      code: `
import express from 'express';
import { requireAuth } from './auth.js';
import { pool } from './db.js';

export const orders = express.Router();

orders.get('/orders/:id', requireAuth, async (req, res) => {
  // The owner comes from the verified session, never from the request.
  const { rows } = await pool.query(
    'SELECT id, status, total_cents, currency, created_at FROM orders WHERE id = $1 AND owner_id = $2',
    [req.params.id, req.user.id]
  );
  // Same 404 for "missing" and "not yours", so ids cannot be probed.
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(rows[0]);
});

// Writes are scoped the same way: a DELETE that matches no row removes nothing.
orders.delete('/orders/:id', requireAuth, async (req, res) => {
  const result = await pool.query('DELETE FROM orders WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
  res.status(result.rowCount === 0 ? 404 : 204).end();
});
`,
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import current_user
from .db import get_db
from .models import Order, User
from .schemas import OrderOut

router = APIRouter()


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # Scope the query to the caller; never accept a user id from the client.
    order = db.scalar(select(Order).where(Order.id == order_id, Order.owner_id == user.id))
    if order is None:
        # Same 404 for "missing" and "not yours", so ids cannot be probed.
        raise HTTPException(status_code=404, detail="not_found")
    return order
`,
    },
    django: {
      note: 'Never set queryset = Order.objects.all() on a view that serves one user\'s data.',
      code: `
from rest_framework import permissions, viewsets

from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Every lookup (retrieve, update, destroy) runs against this queryset,
        # so another user's id returns 404 instead of their order.
        return Order.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        # The owner is set from the session, never from the request body.
        serializer.save(owner=self.request.user)
`,
    },
    laravel: {
      note: 'Route model binding on its own (Order $order) does not check ownership; scope the query or add a policy.',
      code: `
<?php

namespace App\\Http\\Controllers;

use App\\Http\\Resources\\OrderResource;
use App\\Models\\Order;
use Illuminate\\Http\\Request;

class OrderController extends Controller
{
    public function show(Request $request, int $id)
    {
        // Scope to the authenticated user; firstOrFail() gives the same 404
        // for "missing" and "not yours", so ids cannot be probed.
        $order = Order::where('id', $id)
            ->where('owner_id', $request->user()->id)
            ->firstOrFail();

        return new OrderResource($order);
    }

    public function destroy(Request $request, int $id)
    {
        $request->user()->orders()->findOrFail($id)->delete();

        return response()->noContent();
    }
}
`,
    },
    spring: {
      code: `
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

interface OrderRepository extends JpaRepository<Order, Long> {
    Optional<Order> findByIdAndOwnerId(Long id, String ownerId);
}

@RestController
@RequestMapping("/orders")
class OrderController {
    private final OrderRepository orders;

    OrderController(OrderRepository orders) { this.orders = orders; }

    @GetMapping("/{id}")
    OrderView get(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        // The owner comes from the verified token, never from the request.
        return orders.findByIdAndOwnerId(id, jwt.getSubject())
                .map(OrderView::from)
                // Same 404 for "missing" and "not yours", so ids cannot be probed.
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
`,
    },
  }),

  // ---------- API2: authentication ----------
  'require-auth': family({
    express: {
      note: 'One app-level check before every router means a route added later cannot be left open by accident.',
      code: `
import express from 'express';
import { verifyAccessToken } from './tokens.js';
import { invoices, orders, refunds } from './routes.js';

const app = express();

// The only routes reachable without a user. Everything else is denied by default.
const PUBLIC_ROUTES = new Set(['GET /health', 'POST /auth/login']);

app.use(async (req, res, next) => {
  if (PUBLIC_ROUTES.has(\`\${req.method} \${req.path}\`)) return next();
  const header = req.get('authorization') ?? ''; // header only, never ?api_key= in the URL
  try {
    if (!header.startsWith('Bearer ')) throw new Error('missing token');
    req.user = await verifyAccessToken(header.slice(7)); // signature, exp, iss, aud
    return next();
  } catch {
    return res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'unauthorized' });
  }
});

app.use(orders);
app.use(refunds);
app.use(invoices);
`,
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .routers import health, invoices, orders, refunds
from .tokens import verify_access_token

bearer = HTTPBearer(auto_error=False)  # Authorization header only, never ?api_key=


def require_user(request: Request, creds: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, headers={"WWW-Authenticate": "Bearer"})
    request.state.user = verify_access_token(creds.credentials)  # raises 401 on a bad token
    return request.state.user


# Deny by default: every route under this router requires a user.
protected = APIRouter(dependencies=[Depends(require_user)])
protected.include_router(orders.router)
protected.include_router(refunds.router)
protected.include_router(invoices.router)

app = FastAPI()
app.include_router(protected)
app.include_router(health.router)  # explicit opt-out: the only public routes
`,
    },
    django: {
      note: 'Uses djangorestframework-simplejwt; for plain Django views outside DRF, add LoginRequiredMiddleware (Django 5.1+).',
      code: `
# settings.py: deny by default for every DRF view.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# views.py: public endpoints opt out explicitly, one at a time.
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})
`,
    },
    laravel: {
      note: 'Requires Laravel Sanctum (php artisan install:api), which reads the token from the Authorization header.',
      code: `
<?php
// routes/api.php

use App\\Http\\Controllers\\AuthController;
use App\\Http\\Controllers\\InvoiceController;
use App\\Http\\Controllers\\OrderController;
use App\\Http\\Controllers\\RefundController;
use Illuminate\\Support\\Facades\\Route;

// Explicit opt-out: the only public routes.
Route::get('/health', fn () => ['status' => 'ok']);
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Deny by default: Sanctum checks the bearer token and returns 401 without one.
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('orders', OrderController::class);
    Route::post('/refunds', [RefundController::class, 'store']);
    Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
});
`,
    },
    spring: {
      note: 'Needs spring-boot-starter-oauth2-resource-server and spring.security.oauth2.resourceserver.jwt.issuer-uri.',
      code: `
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // Explicit opt-out for the few public routes.
                .requestMatchers(HttpMethod.GET, "/health").permitAll()
                // Deny by default: everything else needs a valid bearer token.
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
        return http.build();
    }
}
`,
    },
  }),

  'require-scope': family({
    express: {
      note: 'Give each client only the scopes it needs; a token that carries every scope defeats the check.',
      code: `
import express from 'express';
import { createRefund, deleteOrder, getRefund } from './handlers.js';

// Deny by default: the route runs only if the token carries every listed scope.
export function requireScope(...needed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' });
    const granted = new Set(String(req.user.scope ?? '').split(' ').filter(Boolean));
    if (needed.length === 0 || !needed.every((s) => granted.has(s))) {
      res.set('WWW-Authenticate', \`Bearer error="insufficient_scope", scope="\${needed.join(' ')}"\`);
      return res.status(403).json({ error: 'insufficient_scope' });
    }
    return next();
  };
}

export const refunds = express.Router();
refunds.get('/refunds/:id', requireScope('refunds:read'), getRefund);
refunds.post('/refunds', requireScope('refunds:write'), createRefund);
// Admin actions need their own scope; being signed in is not enough.
refunds.delete('/admin/orders/:id', requireScope('admin:orders'), deleteOrder);
`,
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import SecurityScopes

from .auth import current_user  # verifies the token; user.scopes comes from its claims
from .schemas import RefundIn
from .services import orders, refunds


def require_scopes(security_scopes: SecurityScopes, user=Depends(current_user)):
    required = set(security_scopes.scopes)
    # Deny by default: a route that declares no scopes is closed, not open.
    if not required or not required <= set(user.scopes):
        raise HTTPException(403, "insufficient_scope",
                            headers={"WWW-Authenticate": f'Bearer scope="{security_scopes.scope_str}"'})
    return user


router = APIRouter()


@router.post("/refunds", status_code=201)
def create_refund(body: RefundIn, user=Security(require_scopes, scopes=["refunds:write"])):
    return refunds.create(body, requested_by=user.id)


@router.delete("/admin/orders/{order_id}", status_code=204)
def delete_order(order_id: int, user=Security(require_scopes, scopes=["admin"])):
    orders.delete(order_id, deleted_by=user.id)
`,
    },
    django: {
      note: 'Here request.auth is the simplejwt AccessToken; adapt the scope lookup to your token class.',
      code: `
from rest_framework.permissions import BasePermission, IsAdminUser, IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from .models import Order, Refund
from .serializers import OrderSerializer, RefundSerializer


class HasScope(BasePermission):
    # Deny by default: an action with no declared scopes is refused.
    def has_permission(self, request, view):
        required = getattr(view, "required_scopes", {}).get(view.action)
        if not required or request.auth is None:
            return False
        granted = set(str(request.auth.get("scope", "")).split())
        return set(required) <= granted


class RefundViewSet(ModelViewSet):
    serializer_class = RefundSerializer
    permission_classes = [IsAuthenticated, HasScope]
    required_scopes = {"list": ["refunds:read"], "retrieve": ["refunds:read"], "create": ["refunds:write"]}

    def get_queryset(self):
        return Refund.objects.filter(order__owner=self.request.user)


class AdminOrderViewSet(ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]  # staff role, checked on the server
`,
    },
    laravel: {
      note: "Issue tokens with explicit abilities, e.g. createToken('reports', ['refunds:read']), never the default ['*'].",
      code: `
<?php
// routes/api.php

use App\\Http\\Controllers\\AdminOrderController;
use App\\Http\\Controllers\\RefundController;
use Illuminate\\Support\\Facades\\Route;
use Laravel\\Sanctum\\Http\\Middleware\\CheckAbilities;

Route::middleware('auth:sanctum')->group(function () {
    // Each route names the token ability it needs; a token without it gets 403.
    Route::get('/refunds/{refund}', [RefundController::class, 'show'])
        ->middleware(CheckAbilities::class.':refunds:read');
    Route::post('/refunds', [RefundController::class, 'store'])
        ->middleware(CheckAbilities::class.':refunds:write');

    // Admin routes check the role on the server through a Gate.
    Route::delete('/admin/orders/{order}', [AdminOrderController::class, 'destroy'])
        ->middleware('can:admin');
});

// app/Providers/AppServiceProvider.php, inside boot()
// (imports: App\\Models\\User, Illuminate\\Support\\Facades\\Gate):
Gate::define('admin', fn (User $user) => $user->role === 'admin');
`,
    },
    spring: {
      note: "Spring maps each scope in the token to a SCOPE_ authority; for method-level checks use @PreAuthorize with hasAuthority('SCOPE_refunds:write').",
      code: `
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class SecurityConfig {

    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/refunds/**").hasAuthority("SCOPE_refunds:read")
                .requestMatchers(HttpMethod.POST, "/refunds").hasAuthority("SCOPE_refunds:write")
                .requestMatchers("/admin/**").hasAuthority("SCOPE_admin")
                .requestMatchers(HttpMethod.GET, "/health").permitAll()
                // Deny by default: a route nobody mapped above is refused, not open.
                .anyRequest().denyAll())
            .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
`,
    },
  }),

  // ---------- API3: property level authorization ----------
  'response-allowlist': family({
    express: {
      note: 'npm install zod; never res.json() a database row or ORM object directly.',
      code: `
import express from 'express';
import { z } from 'zod';
import { orders } from './repo.js';

// Response schema: only these fields leave the server. z.object() drops every
// other key (password_hash, api_token, card_number) when it parses.
const OrderOut = z.object({
  id: z.string(),
  status: z.enum(['pending', 'paid', 'refunded']),
  total_cents: z.number().int(),
  currency: z.string().length(3),
  created_at: z.date(),
  customer: z.object({ id: z.string(), name: z.string(), card_last4: z.string().nullable() }),
});

export const router = express.Router();

router.get('/orders/:id', async (req, res) => {
  const order = await orders.findOwned(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  res.json(OrderOut.parse(order));
});
`,
    },
    fastapi: {
      code: `
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from .deps import owned_order  # loads the order scoped to the current user

router = APIRouter()


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    card_last4: str | None


class OrderOut(BaseModel):
    # Only these fields are serialized; password_hash, api_token and card_number never leave.
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    total_cents: int
    created_at: datetime
    customer: CustomerOut


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order=Depends(owned_order)):
    return order
`,
    },
    django: {
      code: `
from rest_framework import serializers

from .models import Customer, Order


class CustomerSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        # Explicit allow-list. Never fields = "__all__" or exclude = [...]: a column
        # added later (password_hash, api_token) would start leaking.
        fields = ["id", "name", "card_last4"]


class OrderSerializer(serializers.ModelSerializer):
    customer = CustomerSummarySerializer(read_only=True)

    class Meta:
        model = Order
        fields = ["id", "status", "total_cents", "currency", "created_at", "customer"]
        read_only_fields = fields
`,
    },
    laravel: {
      note: "Also list secrets in the model's $hidden array as a second guard, and never return a model or toArray() directly.",
      code: `
<?php

namespace App\\Http\\Resources;

use Illuminate\\Http\\Request;
use Illuminate\\Http\\Resources\\Json\\JsonResource;

class OrderResource extends JsonResource
{
    // Explicit allow-list. A column added later (password_hash, api_token,
    // card_number) is not returned until someone adds it here.
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'total_cents' => $this->total_cents,
            'currency' => $this->currency,
            'created_at' => $this->created_at->toIso8601String(),
            'customer' => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'card_last4' => $this->customer->card_last4,
            ],
        ];
    }
}
`,
    },
    spring: {
      note: 'Return records like this from controllers; @JsonIgnore on entity fields is a weaker deny-list.',
      code: `
import java.time.Instant;

// Controllers return these records, never JPA entities, so fields such as
// passwordHash, apiToken or cardNumber cannot be serialized by accident.
public record OrderView(Long id, String status, long totalCents, String currency,
                        Instant createdAt, CustomerView customer) {

    public static OrderView from(Order o) {
        return new OrderView(o.getId(), o.getStatus().name(), o.getTotalCents(), o.getCurrency(),
                o.getCreatedAt(), CustomerView.from(o.getCustomer()));
    }

    public record CustomerView(Long id, String name, String cardLast4) {
        static CustomerView from(Customer c) {
            return new CustomerView(c.getId(), c.getName(), c.getCardLast4());
        }
    }
}
`,
    },
  }),

  'input-allowlist': family({
    express: {
      note: 'npm install zod; in zod 4 z.strictObject({...}) is the same as z.object({...}).strict().',
      code: `
import express from 'express';
import { z } from 'zod';
import { orders, toOrderDto } from './orders.js';

// Only these fields are accepted. .strict() rejects unknown keys, so a client
// cannot slip in role, balance, owner_id or status.
const CreateOrder = z.object({
  items: z.array(z.object({
    sku: z.string().max(64),
    quantity: z.number().int().min(1).max(100),
  }).strict()).min(1).max(50),
  shipping_address_id: z.string().uuid(),
  note: z.string().max(500).optional(),
}).strict();

export const router = express.Router();

router.post('/orders', async (req, res) => {
  const parsed = CreateOrder.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: 'invalid_body', issues: parsed.error.issues.map((i) => i.message) });
  }
  // Server-owned fields come from the session and the server, never from the body.
  const order = await orders.create({ ...parsed.data, owner_id: req.user.id, status: 'pending' });
  res.status(201).json(toOrderDto(order));
});
`,
    },
    fastapi: {
      code: `
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from .auth import current_user
from .services import orders

router = APIRouter()


class OrderItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sku: Annotated[str, Field(max_length=64)]
    quantity: Annotated[int, Field(ge=1, le=100)]


class OrderIn(BaseModel):
    # extra="forbid" turns unknown keys (role, balance, owner_id, status) into a 422.
    model_config = ConfigDict(extra="forbid")
    items: Annotated[list[OrderItemIn], Field(min_length=1, max_length=50)]
    shipping_address_id: int
    note: Annotated[str | None, Field(max_length=500)] = None


@router.post("/orders", status_code=201)
def create_order(body: OrderIn, user=Depends(current_user)):
    # Server-owned fields are set here, never bound from the request.
    return orders.create(body, owner_id=user.id, status="pending")
`,
    },
    django: {
      code: `
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Order


class OrderWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ["id", "shipping_address", "note", "status", "total_cents"]
        # Server-owned fields are output only; values sent by the client are ignored.
        read_only_fields = ["id", "status", "total_cents"]

    def to_internal_value(self, data):
        # Reject unknown keys (role, balance, owner) instead of silently dropping them.
        unknown = set(data) - set(self.fields) if isinstance(data, dict) else set()
        if unknown:
            raise serializers.ValidationError({key: "Unknown field." for key in sorted(unknown)})
        return super().to_internal_value(data)


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderWriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user, status="pending")
`,
    },
    laravel: {
      note: 'Calling Model::preventSilentlyDiscardingAttributes() in AppServiceProvider makes non-fillable keys throw instead of vanishing.',
      code: `
<?php
// app/Models/Order.php: only these columns can ever be mass-assigned.
class Order extends Model
{
    protected $fillable = ['shipping_address_id', 'note'];
    protected $attributes = ['status' => 'pending'];
}

// app/Http/Controllers/OrderController.php
public function store(Request $request)
{
    // Reject unknown keys (role, balance, owner_id) instead of ignoring them.
    $unknown = array_diff(array_keys($request->all()), ['shipping_address_id', 'note', 'items']);
    abort_if($unknown !== [], 422, 'Unknown fields: '.implode(', ', $unknown));

    $data = $request->validate([
        'shipping_address_id' => ['required', 'integer'],
        'note' => ['nullable', 'string', 'max:500'],
        'items' => ['required', 'array', 'min:1', 'max:50'],
        'items.*.sku' => ['required', 'string', 'max:64'],
        'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
    ]);

    // owner_id comes from the session. Never Order::create($request->all()).
    $order = $request->user()->orders()->create(Arr::only($data, ['shipping_address_id', 'note']));
    $order->items()->createMany($data['items']);

    return new OrderResource($order);
}
`,
    },
    spring: {
      note: 'With fail-on-unknown-properties on, a body with an extra key is refused with 400 before the controller runs.',
      code: `
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

// Request DTO: the only fields a client can set. role, balance, ownerId and
// status do not exist here, so they cannot be bound.
public record CreateOrderRequest(
        @NotNull Long shippingAddressId,
        @Size(max = 500) String note,
        @NotEmpty @Size(max = 50) List<@Valid Item> items) {

    public record Item(@NotBlank @Size(max = 64) String sku, @Min(1) @Max(100) int quantity) {}
}

// application.properties: reject unknown JSON properties (Spring Boot ignores them by default).
// spring.jackson.deserialization.fail-on-unknown-properties=true

// Controller: bind the DTO, never the JPA entity.
@PostMapping("/orders")
@ResponseStatus(HttpStatus.CREATED)
OrderView create(@Valid @RequestBody CreateOrderRequest body, @AuthenticationPrincipal Jwt jwt) {
    // ownerId and status are set on the server, never from the body.
    return OrderView.from(orderService.create(body, jwt.getSubject()));
}
`,
    },
  }),

  // ---------- API4: resource consumption ----------
  'page-limit': family({
    express: {
      code: `
import express from 'express';
import { z } from 'zod';
import { pool } from './db.js';

// Hard ceiling on page size, whatever the client asks for.
const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.coerce.number().int().min(0).default(0), // last id of the previous page
});

export const router = express.Router();

router.get('/orders', async (req, res) => {
  const q = ListQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'invalid_query' });
  const { limit, cursor } = q.data;
  // Keyset pagination: one extra row tells us whether a next page exists.
  const { rows } = await pool.query(
    'SELECT id, status, total_cents, created_at FROM orders WHERE owner_id = $1 AND id > $2 ORDER BY id LIMIT $3',
    [req.user.id, cursor, limit + 1]
  );
  const page = rows.slice(0, limit);
  res.json({ data: page, next_cursor: rows.length > limit ? page.at(-1).id : null });
});
`,
    },
    fastapi: {
      code: `
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .deps import current_user, get_db
from .models import Order
from .schemas import OrderOut

router = APIRouter()


@router.get("/orders")
def list_orders(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,  # hard max: 100 per page
    cursor: Annotated[int, Query(ge=0)] = 0,  # last id of the previous page
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(Order)
        .where(Order.owner_id == user.id, Order.id > cursor)
        .order_by(Order.id)
        .limit(limit + 1)  # one extra row tells us whether a next page exists
    ).all()
    page = rows[:limit]
    next_cursor = page[-1].id if len(rows) > limit else None
    return {"data": [OrderOut.model_validate(o) for o in page], "next_cursor": next_cursor}
`,
    },
    django: {
      note: 'Cursor pagination keeps deep pages cheap; never ship a list endpoint without a paginator.',
      code: `
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "orders.pagination.OrderCursorPagination",
}

# orders/pagination.py
from rest_framework.pagination import CursorPagination


class OrderCursorPagination(CursorPagination):
    ordering = "-created_at"
    page_size = 20
    page_size_query_param = "limit"
    max_page_size = 100  # ?limit=100000 is capped at 100


# orders/views.py: list endpoints inherit the default; set it explicitly where it matters.
from rest_framework import viewsets

from .models import Order
from .pagination import OrderCursorPagination
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    pagination_class = OrderCursorPagination

    def get_queryset(self):
        return Order.objects.filter(owner=self.request.user)
`,
    },
    laravel: {
      code: `
<?php
// app/Http/Controllers/OrderController.php

public function index(Request $request)
{
    $validated = $request->validate([
        'limit' => ['sometimes', 'integer', 'min:1', 'max:100'], // hard max per page
        'cursor' => ['sometimes', 'string', 'max:512'],
    ]);

    // cursorPaginate() reads ?cursor= and stays fast and stable on deep pages.
    $orders = $request->user()->orders()
        ->orderBy('id')
        ->cursorPaginate($validated['limit'] ?? 20);

    return OrderResource::collection($orders);
}
`,
    },
    spring: {
      note: 'Limit needs Spring Data 3.2+; if you take a Pageable instead, also set spring.data.web.pageable.max-page-size=100.',
      code: `
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

record OrderPage(List<OrderView> data, Long nextCursor) {}

@Validated
@RestController
class OrderListController {
    private final OrderRepository orders; // findByOwnerIdAndIdGreaterThanOrderByIdAsc(String, Long, Limit)

    OrderListController(OrderRepository orders) { this.orders = orders; }

    @GetMapping("/orders")
    OrderPage list(@RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit, // hard max
                   @RequestParam(defaultValue = "0") @Min(0) long cursor, // last id of the previous page
                   @AuthenticationPrincipal Jwt jwt) {
        // One extra row tells us whether a next page exists.
        List<Order> rows = orders.findByOwnerIdAndIdGreaterThanOrderByIdAsc(jwt.getSubject(), cursor, Limit.of(limit + 1));
        List<Order> page = rows.subList(0, Math.min(limit, rows.size()));
        Long next = rows.size() > limit ? page.get(page.size() - 1).getId() : null;
        return new OrderPage(page.stream().map(OrderView::from).toList(), next);
    }
}
`,
    },
  }),

  'upload-limit': family({
    express: {
      note: 'npm install multer file-type; written for Express 5, which passes rejected async handlers to the error handler.',
      code: `
import express from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { attachments } from './repo.js';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 }, // 5 MB, one file
});

export const router = express.Router();

router.post('/invoices/:id/attachments', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  // Check the real bytes; the client's Content-Type and file name are not trusted.
  const type = await fileTypeFromBuffer(req.file.buffer);
  if (!type || !ALLOWED_TYPES.has(type.mime)) return res.status(415).json({ error: 'unsupported_file' });
  const saved = await attachments.save(req.params.id, req.user.id, req.file.buffer, type.mime);
  res.status(201).json({ id: saved.id });
});

// Multer limit errors become 413 or 400 instead of a 500.
router.use((err, req, res, next) => {
  if (!(err instanceof multer.MulterError)) return next(err);
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code.toLowerCase() });
});
`,
    },
    fastapi: {
      note: 'pip install filetype python-multipart; also cap the body at the proxy (nginx client_max_body_size 6m), because the form is parsed before this code runs.',
      code: `
import filetype
from fastapi import APIRouter, Depends, HTTPException, UploadFile

from .deps import current_user
from .services import attachments

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg"}

router = APIRouter()


@router.post("/invoices/{invoice_id}/attachments", status_code=201)
async def upload_attachment(invoice_id: int, file: UploadFile, user=Depends(current_user)):
    # Read at most one byte past the limit instead of trusting Content-Length.
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file_too_large")
    # Check the real bytes; the client's content type and file name are not trusted.
    kind = filetype.guess(data)
    if kind is None or kind.mime not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="unsupported_file")
    saved = await attachments.save(invoice_id, user.id, data, kind.mime)
    return {"id": saved.id}
`,
    },
    django: {
      note: 'pip install filetype; also cap the body at the proxy (nginx client_max_body_size 6m), since Django receives the whole upload before validation runs.',
      code: `
import filetype
from rest_framework import serializers

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_TYPES = {"application/pdf", "image/png", "image/jpeg"}


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(max_length=100, allow_empty_file=False)

    def validate_file(self, upload):
        if upload.size > MAX_BYTES:
            raise serializers.ValidationError("File is larger than 5 MB.")
        # Check the real bytes; the client's content type and file name are not trusted.
        kind = filetype.guess(upload.read(261))
        upload.seek(0)
        if kind is None or kind.mime not in ALLOWED_TYPES:
            raise serializers.ValidationError("Only PDF, PNG and JPEG files are accepted.")
        return upload
`,
    },
    laravel: {
      note: 'Set upload_max_filesize and post_max_size in php.ini to match, so PHP refuses oversized bodies before your code runs.',
      code: `
<?php

namespace App\\Http\\Controllers;

use App\\Models\\Invoice;
use Illuminate\\Http\\Request;
use Illuminate\\Validation\\Rules\\File;

class InvoiceAttachmentController extends Controller
{
    public function store(Request $request, Invoice $invoice)
    {
        abort_unless($invoice->owner_id === $request->user()->id, 404);

        $request->validate([
            // types() checks the MIME type detected from the content; max() is in KB (5 MB).
            'file' => ['required', File::types(['pdf', 'png', 'jpg'])->max(5 * 1024)],
        ]);

        // Random file name on a private disk: nothing the client sends ends up in the path.
        $path = $request->file('file')->store("invoices/{$invoice->id}", 'local');
        $attachment = $invoice->attachments()->create(['path' => $path]);

        return response()->json(['id' => $attachment->id], 201);
    }
}
`,
    },
    spring: {
      note: 'Tika is org.apache.tika:tika-core; imports are omitted for length.',
      code: `
// application.properties: oversized requests are refused before the controller runs.
// spring.servlet.multipart.max-file-size=5MB
// spring.servlet.multipart.max-request-size=6MB

@RestController
class InvoiceAttachmentController {
    private static final Set<String> ALLOWED = Set.of("application/pdf", "image/png", "image/jpeg");
    private final Tika tika = new Tika();
    private final AttachmentService attachments;

    InvoiceAttachmentController(AttachmentService attachments) { this.attachments = attachments; }

    @PostMapping(path = "/invoices/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<Map<String, Long>> upload(@PathVariable long id, @RequestParam("file") MultipartFile file,
                                             @AuthenticationPrincipal Jwt jwt) throws IOException {
        // Detect the type from the bytes; the client's Content-Type and file name are not trusted.
        String detected = tika.detect(file.getInputStream());
        if (!ALLOWED.contains(detected)) throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
        long attachmentId = attachments.save(id, jwt.getSubject(), file.getBytes(), detected);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", attachmentId));
    }
}

@RestControllerAdvice
class UploadErrors {
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String, String>> tooLarge() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "file_too_large"));
    }
}
`,
    },
  }),

  'rate-limit': family({
    express: {
      note: 'express-rate-limit v8; use a shared store such as rate-limit-redis when you run more than one instance.',
      code: `
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { apiRouter, authenticate, login } from './app.js';

const limiter = (windowMs, limit, keyGenerator) => rateLimit({
  windowMs,
  limit,
  keyGenerator,
  standardHeaders: 'draft-8', // RateLimit headers; 429 responses also carry Retry-After
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const MIN = 60 * 1000;
// Login is limited per client IP and, separately, per account name, so one
// account cannot be brute-forced from many addresses.
const loginPerIp = limiter(15 * MIN, 20, (req) => ipKeyGenerator(req.ip));
const loginPerAccount = limiter(15 * MIN, 10, (req) => \`acct:\${String(req.body?.email ?? '').toLowerCase()}\`);
// Everything else: per authenticated user, falling back to the client IP.
const perUser = limiter(MIN, 120, (req) => (req.user ? \`user:\${req.user.id}\` : ipKeyGenerator(req.ip)));

const app = express();
app.set('trust proxy', 1); // one proxy in front, so req.ip is the real client
app.post('/auth/login', express.json(), loginPerIp, loginPerAccount, login);
app.use('/api', authenticate, perUser, apiRouter);
`,
    },
    fastapi: {
      note: 'pip install slowapi; pass storage_uri="redis://..." to Limiter when you run more than one worker.',
      code: `
from fastapi import Depends, FastAPI, Request, Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from .deps import current_user  # also sets request.state.user
from .schemas import LoginIn, RefundIn
from .services import auth, refunds

# Per client IP by default; headers_enabled adds Retry-After to 429 responses.
limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"], headers_enabled=True)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.post("/auth/login")
@limiter.limit("10/15minutes")
async def login(request: Request, response: Response, body: LoginIn):
    return await auth.login(body)


@app.post("/refunds", status_code=201)
# Per user: the current_user dependency has run before the limit is checked.
@limiter.limit("20/hour", key_func=lambda request: f"user:{request.state.user.id}")
async def create_refund(request: Request, response: Response, body: RefundIn, user=Depends(current_user)):
    return await refunds.create(body, requested_by=user.id)
`,
    },
    django: {
      note: 'Throttles count in the Django cache; use a shared cache such as Redis so limits hold across workers.',
      code: `
# settings.py
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",  # per client IP
        "rest_framework.throttling.UserRateThrottle",  # per signed-in user
    ],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min", "user": "600/min", "login": "10/min", "refunds": "20/hour"},
    "NUM_PROXIES": 1,  # trust one proxy hop when reading the client IP
}

# views.py: throttled requests get 429 with a Retry-After header.
from rest_framework import viewsets
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class LoginView(TokenObtainPairView):
    throttle_classes = [LoginThrottle]


class RefundViewSet(viewsets.ModelViewSet):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refunds"  # counted per user for signed-in requests
`,
    },
    laravel: {
      note: 'Set CACHE_STORE=redis so the counters are shared by every server.',
      code: `
<?php
// app/Providers/AppServiceProvider.php
use Illuminate\\Cache\\RateLimiting\\Limit;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\RateLimiter;

public function boot(): void
{
    // Per signed-in user, falling back to the client IP.
    RateLimiter::for('api', function (Request $request) {
        return Limit::perMinute(120)->by($request->user()?->id ?: $request->ip());
    });

    // Login: per IP and, separately, per account, so one account cannot be
    // brute-forced from many addresses.
    RateLimiter::for('login', function (Request $request) {
        return [
            Limit::perMinute(10)->by('ip:'.$request->ip()),
            Limit::perHour(20)->by('email:'.strtolower((string) $request->input('email'))),
        ];
    });
}

// routes/api.php: the throttle middleware answers 429 with Retry-After.
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::apiResource('orders', OrderController::class);
    Route::post('/refunds', [RefundController::class, 'store']);
});
`,
    },
    spring: {
      note: "Needs com.bucket4j:bucket4j_jdk17-core and Caffeine (imports omitted for length), plus Bucket4j's Redis integration when you run more than one instance.",
      code: `
// Register after authentication:
// http.addFilterAfter(new RateLimitFilter(), BearerTokenAuthenticationFilter.class);
public class RateLimitFilter extends OncePerRequestFilter {
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000).expireAfterAccess(Duration.ofMinutes(10)).build();

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        // Per authenticated user, falling back to the client IP.
        String key = SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken jwt
                ? "user:" + jwt.getName() : "ip:" + req.getRemoteAddr();
        Bucket bucket = buckets.get(key, k -> Bucket.builder()
                .addLimit(limit -> limit.capacity(120).refillGreedy(120, Duration.ofMinutes(1)))
                .build());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            res.setHeader("RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(req, res);
            return;
        }
        long waitSeconds = TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1;
        res.setStatus(429);
        res.setHeader("Retry-After", String.valueOf(waitSeconds));
        res.setContentType("application/json");
        res.getWriter().write("{\\"error\\":\\"too_many_requests\\"}");
    }
}
`,
    },
  }),

  // ---------- API6: sensitive business flows ----------
  idempotency: family({
    express: {
      note: 'Uses ioredis; a fuller version also stores a hash of the body and answers 422 when a key is reused with a different body.',
      code: `
import express from 'express';
import { requireScope } from './auth.js';
import { redis } from './redis.js'; // ioredis client
import { issueRefund } from './refunds.js';

const DAY = 24 * 60 * 60;
export const router = express.Router();

router.post('/refunds', requireScope('refunds:write'), async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) {
    return res.status(400).json({ error: 'idempotency_key_required' });
  }
  const slot = \`idem:refunds:\${req.user.id}:\${key}\`;
  // SET NX claims the key atomically; a repeat reads the stored result instead.
  if ((await redis.set(slot, 'pending', 'EX', DAY, 'NX')) === null) {
    const stored = await redis.get(slot);
    if (stored === null || stored === 'pending') return res.status(409).json({ error: 'request_in_progress' });
    return res.status(201).json(JSON.parse(stored)); // replay the first result: no second refund
  }
  try {
    const refund = await issueRefund({ orderId: req.body.order_id, amountCents: req.body.amount_cents, userId: req.user.id });
    const result = { id: refund.id, status: refund.status, amount_cents: refund.amount_cents };
    await redis.set(slot, JSON.stringify(result), 'EX', DAY);
    return res.status(201).json(result);
  } catch (err) {
    await redis.del(slot); // a failed attempt can be retried with the same key
    return next(err);
  }
});
`,
    },
    fastapi: {
      note: 'Uses redis.asyncio; any store with an atomic insert-if-absent (a unique index in SQL) works the same way.',
      code: `
import json

from fastapi import APIRouter, Depends, Header, HTTPException

from .deps import current_user, redis  # redis.asyncio.Redis(..., decode_responses=True)
from .refunds import RefundIn, issue_refund

router = APIRouter()


@router.post("/refunds", status_code=201)
async def create_refund(body: RefundIn, user=Depends(current_user),
                        key: str = Header(alias="Idempotency-Key", min_length=16, max_length=64)):
    slot = f"idem:refunds:{user.id}:{key}"
    # SET NX claims the key atomically; a repeat reads the stored result instead.
    if not await redis.set(slot, "pending", ex=86400, nx=True):
        stored = await redis.get(slot)
        if stored in (None, "pending"):
            raise HTTPException(409, "request_in_progress")
        return json.loads(stored)  # replay the first result: no second refund
    try:
        refund = await issue_refund(body, user_id=user.id)
    except Exception:
        await redis.delete(slot)  # a failed attempt can be retried with the same key
        raise
    result = {"id": refund.id, "status": refund.status, "amount_cents": refund.amount_cents}
    await redis.set(slot, json.dumps(result), ex=86400)
    return result
`,
    },
    django: {
      note: 'cache.add() is atomic on the Redis and Memcached backends; the local-memory cache only works inside one process.',
      code: `
from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import RefundSerializer


class RefundCreateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        key = request.headers.get("Idempotency-Key", "")
        if not 16 <= len(key) <= 64:
            return Response({"error": "idempotency_key_required"}, status=400)
        slot = f"idem:refunds:{request.user.pk}:{key}"
        # cache.add() writes only if the key is absent, so exactly one request claims it.
        if not cache.add(slot, "pending", timeout=86400):
            stored = cache.get(slot)
            if stored in (None, "pending"):
                return Response({"error": "request_in_progress"}, status=409)
            return Response(stored, status=201)  # replay the first result: no second refund
        serializer = RefundSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            serializer.save(requested_by=request.user)
        except Exception:
            cache.delete(slot)  # a failed attempt can be retried with the same key
            raise
        cache.set(slot, dict(serializer.data), timeout=86400)
        return Response(serializer.data, status=201)
`,
    },
    laravel: {
      note: 'Cache::add() is atomic on the redis, memcached and database stores; avoid the file and array stores here.',
      code: `
<?php
// app/Http/Controllers/RefundController.php

public function store(Request $request)
{
    $key = (string) $request->header('Idempotency-Key');
    abort_unless(preg_match('/^[A-Za-z0-9_-]{16,64}$/', $key) === 1, 400, 'Idempotency-Key header required.');
    $data = $request->validate([
        'order_id' => ['required', 'integer'],
        'amount_cents' => ['required', 'integer', 'min:1'],
    ]);
    $slot = "idem:refunds:{$request->user()->id}:{$key}";

    // Cache::add() writes only if the key is absent, so exactly one request claims it.
    if (! Cache::add($slot, 'pending', now()->addDay())) {
        $stored = Cache::get($slot);
        abort_if($stored === null || $stored === 'pending', 409, 'Request still in progress.');
        return response()->json($stored, 201); // replay the first result: no second refund
    }

    try {
        $refund = $this->refunds->issue($request->user(), $data);
    } catch (\\Throwable $e) {
        Cache::forget($slot); // a failed attempt can be retried with the same key
        throw $e;
    }
    $result = ['id' => $refund->id, 'status' => $refund->status, 'amount_cents' => $refund->amount_cents];
    Cache::put($slot, $result, now()->addDay());
    return response()->json($result, 201);
}
`,
    },
    spring: {
      note: 'redis is a StringRedisTemplate and json the Jackson ObjectMapper; put @Validated on the controller so @Pattern is enforced.',
      code: `
@PostMapping("/refunds")
ResponseEntity<RefundView> create(
        @RequestHeader("Idempotency-Key") @Pattern(regexp = "[A-Za-z0-9_-]{16,64}") String key,
        @Valid @RequestBody RefundRequest body,
        @AuthenticationPrincipal Jwt jwt) throws JsonProcessingException {
    String slot = "idem:refunds:" + jwt.getSubject() + ":" + key;
    // setIfAbsent is atomic, so only the first request with this key runs.
    if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(slot, "pending", Duration.ofDays(1)))) {
        String stored = redis.opsForValue().get(slot);
        if (stored == null || stored.equals("pending")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "request_in_progress");
        }
        // Replay the first result: no second refund.
        return ResponseEntity.status(HttpStatus.CREATED).body(json.readValue(stored, RefundView.class));
    }
    try {
        RefundView created = RefundView.from(refunds.issue(body, jwt.getSubject()));
        redis.opsForValue().set(slot, json.writeValueAsString(created), Duration.ofDays(1));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    } catch (RuntimeException e) {
        redis.delete(slot); // a failed attempt can be retried with the same key
        throw e;
    }
}
`,
    },
  }),

  // ---------- API7: server side request forgery ----------
  'ssrf-guard': family({
    express: {
      note: 'npm install undici ipaddr.js; import fetch from undici as well, so the pinned dispatcher is honoured.',
      code: `
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';

const ALLOWED_HOSTS = new Set(['files.partner.example', 'hooks.partner.example']);

export async function fetchPartnerFile(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname) || url.username || url.password) {
    throw new Error('url_not_allowed');
  }
  // Only public unicast addresses: no 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1 or fc00::/7.
  const addrs = await lookup(url.hostname, { all: true });
  if (addrs.length === 0 || addrs.some((a) => ipaddr.process(a.address).range() !== 'unicast')) {
    throw new Error('url_not_allowed');
  }
  // Pin the socket to the checked address, so DNS cannot change between check and connect.
  const { address, family } = addrs[0];
  const dispatcher = new Agent({
    maxResponseSize: 1024 * 1024, // 1 MB cap on the body
    connect: { lookup: (_h, opts, cb) => (opts.all ? cb(null, [{ address, family }]) : cb(null, address, family)) },
  });
  try {
    const res = await fetch(url, { dispatcher, redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('upstream_error');
    return Buffer.from(await res.arrayBuffer());
  } finally {
    await dispatcher.close();
  }
}
`,
    },
    fastapi: {
      note: 'pip install httpx; the sni_hostname extension keeps certificate checks on the real host name while connecting to the pinned IP.',
      code: `
import asyncio
import ipaddress
from urllib.parse import urlsplit

import httpx

ALLOWED_HOSTS = {"files.partner.example", "hooks.partner.example"}


async def fetch_partner_file(raw_url: str) -> bytes:
    url = urlsplit(raw_url)
    if url.scheme != "https" or url.hostname not in ALLOWED_HOSTS or url.username:
        raise ValueError("url_not_allowed")
    infos = await asyncio.get_running_loop().getaddrinfo(url.hostname, url.port or 443)
    addrs = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not all(a.is_global for a in addrs):  # no 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7
        raise ValueError("url_not_allowed")
    # Connect to the checked address; Host and SNI keep TLS verification on the real name.
    ip = f"[{addrs[0]}]" if addrs[0].version == 6 else str(addrs[0])
    pinned = url._replace(netloc=f"{ip}:{url.port or 443}").geturl()
    async with httpx.AsyncClient(follow_redirects=False, timeout=5.0) as client:
        async with client.stream("GET", pinned, headers={"Host": url.hostname},
                                 extensions={"sni_hostname": url.hostname}) as resp:
            resp.raise_for_status()
            body = bytearray()
            async for chunk in resp.aiter_bytes():
                body += chunk
                if len(body) > 1024 * 1024:  # 1 MB cap
                    raise ValueError("response_too_large")
            return bytes(body)
`,
    },
    django: {
      note: 'pip install httpx; call this from the view or task instead of passing the user URL to requests.get().',
      code: `
import ipaddress
import socket
from urllib.parse import urlsplit

import httpx

ALLOWED_HOSTS = {"files.partner.example", "hooks.partner.example"}


def fetch_partner_file(raw_url: str) -> bytes:
    url = urlsplit(raw_url)
    if url.scheme != "https" or url.hostname not in ALLOWED_HOSTS or url.username:
        raise ValueError("url_not_allowed")
    infos = socket.getaddrinfo(url.hostname, url.port or 443, type=socket.SOCK_STREAM)
    addrs = [ipaddress.ip_address(info[4][0]) for info in infos]
    if not all(a.is_global for a in addrs):  # no 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7
        raise ValueError("url_not_allowed")
    # Connect to the checked address; Host and SNI keep TLS verification on the real name.
    ip = f"[{addrs[0]}]" if addrs[0].version == 6 else str(addrs[0])
    pinned = url._replace(netloc=f"{ip}:{url.port or 443}").geturl()
    with httpx.Client(follow_redirects=False, timeout=5.0) as client:
        with client.stream("GET", pinned, headers={"Host": url.hostname},
                           extensions={"sni_hostname": url.hostname}) as resp:
            resp.raise_for_status()
            body = bytearray()
            for chunk in resp.iter_bytes():
                body += chunk
                if len(body) > 1024 * 1024:  # 1 MB cap
                    raise ValueError("response_too_large")
            return bytes(body)
`,
    },
    laravel: {
      note: 'FILTER_FLAG_GLOBAL_RANGE needs PHP 8.2+, and curl 8.4+ enforces CURLOPT_MAXFILESIZE during the transfer.',
      code: `
<?php

use Illuminate\\Support\\Facades\\Http;

final class PartnerFileFetcher
{
    private const ALLOWED_HOSTS = ['files.partner.example', 'hooks.partner.example'];

    public function fetch(string $url): string
    {
        $parts = parse_url($url);
        $host = $parts['host'] ?? '';
        if (($parts['scheme'] ?? '') !== 'https' || ! in_array($host, self::ALLOWED_HOSTS, true) || isset($parts['user'])) {
            throw new \\InvalidArgumentException('url_not_allowed');
        }
        // Every resolved address must be public: FILTER_FLAG_GLOBAL_RANGE rejects
        // 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1 and fc00::/7.
        $ips = array_map(fn (array $r) => $r['ip'] ?? $r['ipv6'], dns_get_record($host, DNS_A | DNS_AAAA) ?: []);
        if ($ips === [] || in_array(false, array_map(fn ($ip) => filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE), $ips), true)) {
            throw new \\InvalidArgumentException('url_not_allowed');
        }
        $pin = str_contains($ips[0], ':') ? "[{$ips[0]}]" : $ips[0];

        return Http::timeout(5)->withoutRedirecting()->withOptions(['curl' => [
            CURLOPT_RESOLVE => ["{$host}:".($parts['port'] ?? 443).":{$pin}"], // connect only to the checked address
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_MAXFILESIZE => 1048576, // 1 MB
        ]])->get($url)->throw()->body();
    }
}
`,
    },
    spring: {
      note: 'Uses Apache HttpClient 5 (httpclient5) under RestClient; imports are omitted for length.',
      code: `
// The check runs inside the connection's own DNS lookup, so the address checked is the address used.
class PublicOnlyDnsResolver extends SystemDefaultDnsResolver {
    static final Set<String> ALLOWED_HOSTS = Set.of("files.partner.example", "hooks.partner.example");
    @Override
    public InetAddress[] resolve(String host) throws UnknownHostException {
        if (!ALLOWED_HOSTS.contains(host)) throw new UnknownHostException("host not allowed: " + host);
        InetAddress[] addrs = super.resolve(host);
        for (InetAddress a : addrs) {
            boolean ula = a instanceof Inet6Address && (a.getAddress()[0] & 0xfe) == 0xfc; // fc00::/7
            if (ula || a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress()
                    || a.isAnyLocalAddress() || a.isMulticastAddress()) {
                throw new UnknownHostException("address not allowed: " + host);
            }
        }
        return addrs;
    }
}

RestClient partner = RestClient.builder().requestFactory(new HttpComponentsClientHttpRequestFactory(HttpClients.custom()
        .setConnectionManager(PoolingHttpClientConnectionManagerBuilder.create().setDnsResolver(new PublicOnlyDnsResolver()).build())
        .setDefaultRequestConfig(RequestConfig.custom().setResponseTimeout(Timeout.ofSeconds(5)).build())
        .disableRedirectHandling().build())).build();

byte[] fetchPartnerFile(String url) {
    URI uri = URI.create(url);
    if (!"https".equals(uri.getScheme())) throw new IllegalArgumentException("url_not_allowed");
    byte[] body = partner.get().uri(uri).exchange((req, res) -> res.getBody().readNBytes(1_048_577));
    if (body.length > 1_048_576) throw new IllegalStateException("response_too_large"); // 1 MB cap
    return body;
}
`,
    },
  }),

  'path-guard': family({
    express: {
      code: `
import express from 'express';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

// Resolved once at startup, with symlinks followed.
const BASE_DIR = await realpath('/srv/app/invoices');

// Resolve the requested name against the base and refuse anything that lands
// outside it: ../ sequences, absolute paths and symlinks pointing elsewhere.
async function resolveInside(base, name) {
  const real = await realpath(path.resolve(base, name)); // throws if the file is missing
  if (!real.startsWith(base + path.sep)) throw new Error('path_outside_base');
  return real;
}

export const router = express.Router();

router.get('/invoices/files/:name', async (req, res) => {
  let file;
  try {
    file = await resolveInside(path.join(BASE_DIR, String(req.user.id)), req.params.name);
  } catch {
    return res.status(404).json({ error: 'not_found' });
  }
  return res.sendFile(file, { dotfiles: 'deny' });
});
`,
    },
    fastapi: {
      code: `
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from .deps import current_user

BASE_DIR = Path("/srv/app/invoices").resolve()
router = APIRouter()


def resolve_inside(base: Path, name: str) -> Path:
    # resolve() collapses ../ and follows symlinks; the result must stay under base.
    target = (base / name).resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise HTTPException(status_code=404, detail="not_found")
    return target


@router.get("/invoices/files/{name}")
def download_invoice(name: str, user=Depends(current_user)):
    path = resolve_inside(BASE_DIR / str(user.id), name)
    return FileResponse(path, media_type="application/pdf")
`,
    },
    django: {
      code: `
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

BASE_DIR = Path(settings.INVOICE_ROOT).resolve()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_invoice(request, name: str):
    user_dir = BASE_DIR / str(request.user.pk)
    # resolve() collapses ../ and follows symlinks; anything outside user_dir is refused.
    target = (user_dir / name).resolve()
    if not target.is_relative_to(user_dir) or not target.is_file():
        raise Http404
    return FileResponse(target.open("rb"), content_type="application/pdf", as_attachment=True, filename=target.name)
`,
    },
    laravel: {
      code: `
<?php
// app/Http/Controllers/InvoiceFileController.php

public function download(Request $request, string $name)
{
    $base = realpath(storage_path('app/invoices/'.$request->user()->id));
    // realpath() collapses ../ and follows symlinks; the result must stay inside $base.
    $target = $base === false ? false : realpath($base.DIRECTORY_SEPARATOR.$name);

    if ($target === false || ! str_starts_with($target, $base.DIRECTORY_SEPARATOR) || ! is_file($target)) {
        abort(404);
    }

    return response()->download($target, basename($target), ['Content-Type' => 'application/pdf']);
}
`,
    },
    spring: {
      code: `
private final Path baseDir = Path.of("/srv/app/invoices").toAbsolutePath().normalize();

@GetMapping("/invoices/files/{name}")
ResponseEntity<Resource> download(@PathVariable String name, @AuthenticationPrincipal Jwt jwt) throws IOException {
    Path userDir = baseDir.resolve(jwt.getSubject()).normalize();
    // normalize() collapses ../ and startsWith() compares whole path segments;
    // toRealPath() then follows symlinks and the check runs again on the real location.
    Path target = userDir.resolve(name).normalize();
    if (!target.startsWith(userDir) || !Files.isRegularFile(target)
            || !target.toRealPath().startsWith(userDir.toRealPath())) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(HttpHeaders.CONTENT_DISPOSITION,
                    ContentDisposition.attachment().filename(target.getFileName().toString()).build().toString())
            .body(new FileSystemResource(target));
}
`,
    },
  }),

  // ---------- API8: security misconfiguration ----------
  'error-handler': family({
    express: {
      note: 'npm install pino; also run with NODE_ENV=production so Express never prints stack traces itself.',
      code: `
import { randomUUID } from 'node:crypto';
import pino from 'pino';

const log = pino();
const CLIENT_ERRORS = { 400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 413: 'payload_too_large' };

// Register last, after every router: app.use(errorHandler).
// Detail goes to the server log only; the client gets a correlation id.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const id = randomUUID();
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  log.error({ err, id, method: req.method, path: req.path, user: req.user?.id }, 'request failed');
  res.set('X-Request-Id', id);
  if (status < 500) return res.status(status).json({ error: CLIENT_ERRORS[status] ?? 'request_error', id });
  return res.status(500).json({ error: 'internal_error', id });
}
`,
    },
    fastapi: {
      code: `
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = logging.getLogger("api")
app = FastAPI(debug=False)


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception) -> JSONResponse:
    error_id = str(uuid.uuid4())
    # The traceback goes to the server log, tagged with the id; the client only gets the id.
    log.error("unhandled error id=%s %s %s", error_id, request.method, request.url.path, exc_info=exc)
    return JSONResponse({"error": "internal_error", "id": error_id}, status_code=500,
                        headers={"X-Request-Id": error_id})


@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Field locations and messages only; never echo the submitted values back.
    fields = [{"loc": err["loc"], "msg": err["msg"]} for err in exc.errors()]
    return JSONResponse({"error": "invalid_request", "fields": fields}, status_code=422)
`,
    },
    django: {
      note: "DRF's handler covers API views; with DEBUG = False, Django's own 500 page for other views shows no detail either.",
      code: `
# settings.py
DEBUG = False  # the debug page shows settings, stack frames and local variables
REST_FRAMEWORK = {"EXCEPTION_HANDLER": "orders.errors.api_exception_handler"}

# orders/errors.py
import logging
import uuid

from rest_framework.response import Response
from rest_framework.views import exception_handler

log = logging.getLogger("api")


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)  # DRF keeps handling 4xx (validation, 401, 403, 404)
    if response is not None:
        return response
    error_id = str(uuid.uuid4())
    request = context["request"]
    log.error("unhandled error id=%s %s %s", error_id, request.method, request.path, exc_info=exc)
    return Response({"error": "internal_error", "id": error_id}, status=500, headers={"X-Request-Id": error_id})
`,
    },
    laravel: {
      note: 'Uses Laravel 11 Context, which adds error_id to the log entry Laravel writes for the exception.',
      code: `
<?php
// bootstrap/app.php (Laravel 11+). Keep APP_DEBUG=false in production.

use Illuminate\\Auth\\AuthenticationException;
use Illuminate\\Foundation\\Configuration\\Exceptions;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Context;
use Illuminate\\Support\\Str;
use Illuminate\\Validation\\ValidationException;
use Symfony\\Component\\HttpKernel\\Exception\\HttpExceptionInterface;

->withExceptions(function (Exceptions $exceptions) {
    // Runs before Laravel logs the exception, so the log entry carries the id.
    $exceptions->report(function (Throwable $e) {
        Context::add('error_id', (string) Str::uuid());
    });

    $exceptions->render(function (Throwable $e, Request $request) {
        if (! $request->expectsJson() || $e instanceof HttpExceptionInterface
            || $e instanceof ValidationException || $e instanceof AuthenticationException) {
            return null; // expected 4xx responses keep Laravel's own rendering
        }
        $id = Context::get('error_id') ?? (string) Str::uuid();

        return response()->json(['error' => 'internal_error', 'id' => $id], 500, ['X-Request-Id' => $id]);
    });
})
`,
    },
    spring: {
      note: 'Extending ResponseEntityExceptionHandler keeps Spring MVC\'s own 4xx answers (bad JSON, validation, 405, 415).',
      code: `
// application.properties: never render stack traces or exception messages.
// server.error.include-stacktrace=never
// server.error.include-message=never

@RestControllerAdvice
class GlobalErrorHandler extends ResponseEntityExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalErrorHandler.class);

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> unhandled(Exception ex, HttpServletRequest req) throws Exception {
        if (ex instanceof AccessDeniedException || ex instanceof AuthenticationException) {
            throw ex; // let Spring Security answer 403 / 401
        }
        String id = UUID.randomUUID().toString();
        // The stack trace goes to the server log, tagged with the id; the client only gets the id.
        log.error("unhandled error id={} {} {}", id, req.getMethod(), req.getRequestURI(), ex);
        return ResponseEntity.internalServerError()
                .header("X-Request-Id", id)
                .body(Map.of("error", "internal_error", "id", id));
    }
}
`,
    },
  }),

  'security-headers': family({
    express: {
      note: 'npm install helmet (v7 or later); it also removes the X-Powered-By header.',
      code: `
import express from 'express';
import helmet from 'helmet';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // TLS ends at the proxy; req.secure reads X-Forwarded-Proto

// Refuse plain HTTP instead of serving API data over it.
app.use((req, res, next) => (req.secure ? next() : res.status(403).json({ error: 'https_required' })));

app.use(helmet({
  // A JSON API never loads scripts or gets framed.
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  xContentTypeOptions: true, // nosniff
  xFrameOptions: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
}));

// Authenticated responses must not be stored by browsers or shared caches.
app.use((req, res, next) => {
  if (req.get('authorization') || req.get('cookie')) res.set('Cache-Control', 'no-store');
  next();
});
`,
    },
    fastapi: {
      note: 'Start uvicorn with --no-server-header (and --proxy-headers behind a TLS proxy) so it does not announce itself.',
      code: `
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

# No public docs UI in production; the CSP below would block it anyway.
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    # Refuse plain HTTP instead of serving API data over it.
    if request.url.scheme != "https":
        return JSONResponse({"error": "https_required"}, status_code=403)
    response = await call_next(request)
    response.headers.update(SECURITY_HEADERS)
    if "authorization" in request.headers or "cookie" in request.headers:
        response.headers["Cache-Control"] = "no-store"  # never cache personal data
    return response
`,
    },
    django: {
      note: 'Hide the app server banner at the reverse proxy (nginx: proxy_hide_header Server; server_tokens off).',
      code: `
# settings.py
SECURE_SSL_REDIRECT = True  # plain HTTP is redirected to HTTPS
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")  # only behind a proxy that sets it
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "no-referrer"
X_FRAME_OPTIONS = "DENY"
MIDDLEWARE += ["orders.middleware.ApiHeadersMiddleware"]  # SecurityMiddleware stays first

# orders/middleware.py
from django.conf import settings
from django.utils.cache import patch_cache_control


class ApiHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if "Authorization" in request.headers or settings.SESSION_COOKIE_NAME in request.COOKIES:
            patch_cache_control(response, no_store=True, private=True)  # never cache personal data
        return response
`,
    },
    laravel: {
      note: 'Register it in bootstrap/app.php with $middleware->api(append: SecurityHeaders::class), and set expose_php = Off in php.ini.',
      code: `
<?php

namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;
use Symfony\\Component\\HttpFoundation\\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        // Refuse plain HTTP (configure TrustProxies when TLS ends at a proxy).
        abort_unless($request->secure(), 403, 'HTTPS required.');

        $response = $next($request);
        $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        header_remove('X-Powered-By');
        if ($request->bearerToken() || $request->hasSession()) {
            $response->headers->set('Cache-Control', 'no-store, private'); // never cache personal data
        }

        return $response;
    }
}
`,
    },
    spring: {
      note: 'Spring Security writes HSTS only on HTTPS requests; terminate TLS in front and close plain HTTP there.',
      code: `
// Inside your @Configuration class.
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    http
        .headers(h -> h
            .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
            .contentTypeOptions(Customizer.withDefaults()) // nosniff
            .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'"))
            .frameOptions(frame -> frame.deny())
            .referrerPolicy(ref -> ref.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
            .cacheControl(Customizer.withDefaults())) // Cache-Control: no-cache, no-store, max-age=0
        .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
    return http.build();
}

// application.properties
// server.server-header=                    (no Server banner)
// server.forward-headers-strategy=native   (behind a TLS proxy, so requests count as secure)
`,
    },
  }),

  'cors-allowlist': family({
    express: {
      note: 'npm install cors; when the origin is not listed, no Access-Control-Allow-Origin header is sent at all.',
      code: `
import cors from 'cors';
import express from 'express';

const app = express();

// Exact origins only: no "*", no regex built from input, never "null".
const ALLOWED_ORIGINS = new Set(['https://app.example.com', 'https://admin.example.com']);

app.use(cors({
  // The Origin header is echoed back only when it is on the list above.
  origin: (origin, callback) => callback(null, origin !== undefined && ALLOWED_ORIGINS.has(origin)),
  credentials: true, // browsers honour this only together with an allowed origin
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  maxAge: 600,
}));
// cors adds Vary: Origin, so shared caches keep one copy per origin.
`,
    },
    fastapi: {
      code: `
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Exact origins only: never "*", never "null", no allow_origin_regex built from input.
    allow_origins=["https://app.example.com", "https://admin.example.com"],
    allow_credentials=True,  # only paired with the fixed list above
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    max_age=600,
)
# With an explicit list, Starlette adds Vary: Origin to every response.
`,
    },
    django: {
      note: 'pip install django-cors-headers.',
      code: `
# settings.py
INSTALLED_APPS += ["corsheaders"]
MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware")  # before CommonMiddleware

# Exact origins only. Never CORS_ALLOW_ALL_ORIGINS = True, never "null".
CORS_ALLOWED_ORIGINS = [
    "https://app.example.com",
    "https://admin.example.com",
]
CORS_ALLOW_CREDENTIALS = True  # only applies to the origins above
CORS_ALLOW_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
CORS_ALLOW_HEADERS = ["authorization", "content-type", "idempotency-key"]
CORS_PREFLIGHT_MAX_AGE = 600
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS  # same list for cookie-authenticated writes
`,
    },
    laravel: {
      code: `
<?php
// config/cors.php, read by Laravel's built-in HandleCors middleware.

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PATCH', 'DELETE'],
    // Exact origins only: never '*', never 'null', no patterns built from input.
    'allowed_origins' => ['https://app.example.com', 'https://admin.example.com'],
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Authorization', 'Content-Type', 'Idempotency-Key'],
    'exposed_headers' => [],
    'max_age' => 600,
    'supports_credentials' => true, // only meaningful together with the fixed list above
];
`,
    },
    spring: {
      code: `
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
class CorsConfig {

    // Picked up by http.cors(Customizer.withDefaults()) in the SecurityFilterChain.
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cors = new CorsConfiguration();
        // Exact origins only: no "*", no allowedOriginPatterns, never "null".
        cors.setAllowedOrigins(List.of("https://app.example.com", "https://admin.example.com"));
        cors.setAllowCredentials(true); // Spring refuses credentials together with "*"
        cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
        cors.setMaxAge(600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cors);
        return source; // Spring's CORS processor adds Vary: Origin
    }
}
`,
    },
  }),

  'cookie-flags': family({
    express: {
      note: 'npm install express-session connect-redis; call req.session.regenerate() after login to prevent session fixation.',
      code: `
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { redis } from './redis.js';

const app = express();
app.set('trust proxy', 1); // TLS ends at the proxy; needed for Secure cookies

app.use(session({
  name: '__Host-sid', // __Host- prefix: the browser requires Secure, Path=/ and no Domain
  secret: process.env.SESSION_SECRET,
  store: new RedisStore({ client: redis }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: true,
    httpOnly: true, // not readable from JavaScript
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60 * 1000, // 30 minutes, renewed while the user is active
  },
}));
`,
    },
    fastapi: {
      code: `
from fastapi import APIRouter, Response

from .schemas import LoginIn
from .services import auth, sessions

router = APIRouter()
SESSION_MAX_AGE = 30 * 60  # 30 minutes


@router.post("/auth/login", status_code=204)
async def login(body: LoginIn, response: Response):
    user = await auth.authenticate(body.email, body.password)  # raises 401 on failure
    session_id = await sessions.create(user.id, ttl=SESSION_MAX_AGE)  # random, stored server-side
    response.set_cookie(
        key="__Host-sid",  # __Host- prefix: the browser requires Secure, Path=/ and no Domain
        value=session_id,
        max_age=SESSION_MAX_AGE,
        path="/",
        secure=True,
        httponly=True,  # not readable from JavaScript
        samesite="lax",
    )
`,
    },
    django: {
      code: `
# settings.py
SESSION_COOKIE_NAME = "__Host-sessionid"  # __Host- prefix: the browser requires Secure, Path=/ and no Domain
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True  # not readable from JavaScript
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_PATH = "/"
SESSION_COOKIE_DOMAIN = None
SESSION_COOKIE_AGE = 30 * 60  # 30 minutes
SESSION_SAVE_EVERY_REQUEST = True  # sliding expiry while the user is active

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "Lax"

# views.py: django.contrib.auth.login() rotates the session key on sign-in,
# which prevents session fixation. Call it rather than writing session keys yourself.
`,
    },
    laravel: {
      code: `
<?php
// config/session.php: the keys that control the session cookie (leave the others as they are).

return [
    'driver' => env('SESSION_DRIVER', 'database'),
    'lifetime' => 30,              // minutes
    'expire_on_close' => false,
    'encrypt' => true,
    'cookie' => '__Host-session',  // __Host- prefix: the browser requires Secure, Path=/ and no Domain
    'path' => '/',
    'domain' => null,
    'secure' => true,
    'http_only' => true,           // not readable from JavaScript
    'same_site' => 'lax',
];

// After a successful login, issue a new session id (prevents session fixation):
// $request->session()->regenerate();
`,
    },
    spring: {
      code: `
// application.properties, for the servlet session cookie:
// server.servlet.session.cookie.secure=true
// server.servlet.session.cookie.http-only=true
// server.servlet.session.cookie.same-site=lax
// server.servlet.session.cookie.path=/
// server.servlet.session.timeout=30m

// A cookie you set yourself, for example after login:
@PostMapping("/auth/login")
ResponseEntity<Void> login(@Valid @RequestBody LoginRequest body) {
    String sessionId = sessions.create(auth.authenticate(body), Duration.ofMinutes(30)); // random, server-side
    ResponseCookie cookie = ResponseCookie.from("__Host-sid", sessionId) // __Host-: Secure, Path=/, no Domain
            .secure(true)
            .httpOnly(true) // not readable from JavaScript
            .sameSite("Lax")
            .path("/")
            .maxAge(Duration.ofMinutes(30))
            .build();
    return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.toString()).build();
}
`,
    },
  }),

  'jwt-verify': family({
    express: {
      note: 'npm install jose; jwtVerify only ever uses the key set you pass, so jku and x5u headers in a token are ignored.',
      code: `
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = 'https://auth.example.com/';
const AUDIENCE = 'https://api.example.com';
// Keys come only from the known issuer's JWKS; kid is just a lookup key into it.
const JWKS = createRemoteJWKSet(new URL('https://auth.example.com/.well-known/jwks.json'));

export async function authenticate(req, res, next) {
  const header = req.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      algorithms: ['RS256'], // pinned: "none" and HS256/RS256 confusion are rejected
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ['exp', 'iat', 'sub'],
      maxTokenAge: '1h', // refuse long-lived tokens even if exp is far away
      clockTolerance: 30,
    });
    req.user = { id: payload.sub, scope: payload.scope };
    return next();
  } catch {
    return res.set('WWW-Authenticate', 'Bearer error="invalid_token"').status(401).json({ error: 'unauthorized' });
  }
}
`,
    },
    fastapi: {
      note: "pip install 'pyjwt[crypto]'; PyJWT never follows jku, x5u or jwk headers on its own.",
      code: `
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

ISSUER = "https://auth.example.com/"
AUDIENCE = "https://api.example.com"
# Keys come only from the known issuer's JWKS; kid is just a lookup key into it.
jwks = jwt.PyJWKClient("https://auth.example.com/.well-known/jwks.json", cache_keys=True)
bearer = HTTPBearer()


def current_claims(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        key = jwks.get_signing_key_from_jwt(creds.credentials).key
        return jwt.decode(
            creds.credentials,
            key,
            algorithms=["RS256"],  # pinned: "none" and HS256/RS256 confusion are rejected
            issuer=ISSUER,
            audience=AUDIENCE,
            leeway=30,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid_token", headers={"WWW-Authenticate": "Bearer"})
`,
    },
    django: {
      note: "pip install 'pyjwt[crypto]'; djangorestframework-simplejwt can do the same with its ALGORITHM, ISSUER, AUDIENCE and JWK_URL settings.",
      code: `
import jwt
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

ISSUER = "https://auth.example.com/"
AUDIENCE = "https://api.example.com"
jwks = jwt.PyJWKClient("https://auth.example.com/.well-known/jwks.json", cache_keys=True)


class IssuerJWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        token = header.removeprefix("Bearer ")
        try:
            # kid is only a lookup key into the issuer's JWKS; jku, x5u and jwk headers are ignored.
            key = jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(token, key, algorithms=["RS256"], issuer=ISSUER, audience=AUDIENCE,
                                leeway=30, options={"require": ["exp", "iat", "iss", "aud", "sub"]})
        except jwt.PyJWTError:
            raise exceptions.AuthenticationFailed("invalid_token")
        user = get_user_model().objects.filter(external_id=claims["sub"], is_active=True).first()
        if user is None:
            raise exceptions.AuthenticationFailed("invalid_token")
        return user, claims

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
`,
    },
    laravel: {
      note: 'composer require firebase/php-jwt; the provider also needs use lines for Auth, Cache, Http, Request, User, JWT and JWK.',
      code: `
<?php
// app/Providers/AppServiceProvider.php, inside boot(). In config/auth.php add
// 'guards' => ['api' => ['driver' => 'issuer-jwt']], then protect routes with auth:api.

Auth::viaRequest('issuer-jwt', function (Request $request) {
    $token = $request->bearerToken();
    if (! $token) {
        return null;
    }
    // Keys come only from the known issuer's JWKS; jku, x5u and jwk headers are never used.
    $jwks = Cache::remember('issuer-jwks', 3600, fn () => Http::timeout(5)
        ->get('https://auth.example.com/.well-known/jwks.json')->throw()->json());
    // Pin RS256: drop any key that declares another algorithm.
    $jwks['keys'] = array_values(array_filter($jwks['keys'], fn ($k) => ($k['alg'] ?? 'RS256') === 'RS256'));
    try {
        JWT::$leeway = 30;
        $claims = JWT::decode($token, JWK::parseKeySet($jwks, 'RS256')); // signature, exp, nbf, iat
    } catch (\\Throwable) {
        return null;
    }
    // php-jwt does not require exp or check iss and aud, so do it here.
    if (! isset($claims->exp, $claims->sub) || ($claims->iss ?? null) !== 'https://auth.example.com/'
        || ! in_array('https://api.example.com', (array) ($claims->aud ?? []), true)) {
        return null;
    }

    return User::where('external_id', $claims->sub)->first();
});
`,
    },
    spring: {
      note: 'Spring Security picks this JwtDecoder bean up for oauth2ResourceServer(oauth -> oauth.jwt(...)).',
      code: `
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;

@Bean
JwtDecoder jwtDecoder() {
    // Keys come only from the known issuer's JWKS; jku, x5u and jwk headers are never used.
    NimbusJwtDecoder decoder = NimbusJwtDecoder
            .withJwkSetUri("https://auth.example.com/.well-known/jwks.json")
            .jwsAlgorithm(SignatureAlgorithm.RS256) // pinned: "none" and HS256/RS256 confusion are rejected
            .build();
    decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer("https://auth.example.com/"), // iss, exp, nbf (60 s skew)
            new JwtClaimValidator<Instant>(JwtClaimNames.EXP, Objects::nonNull), // exp is required
            new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                    aud -> aud != null && aud.contains("https://api.example.com"))));
    return decoder;
}
`,
    },
  }),

  // ---------- AI agents and LLM features ----------
  'agent-approval': family({
    express: {
      note: 'The agent token must not be able to call the confirm route; approval has to come from the person, on a separate credential.',
      code: `
import express from 'express';
import { requireHumanSession, requireScope } from './auth.js';
import { IssueRefundArgs, orders, pendingActions, refunds } from './domain.js';

const MAX_OPEN_ACTIONS = 5; // per user
export const router = express.Router();

// Agent tool "issue_refund": records a pending action and returns it. No money moves here.
router.post('/agent/tools/issue_refund', requireScope('agent:tools'), async (req, res) => {
  const { success, data: args } = IssueRefundArgs.safeParse(req.body); // strict zod schema
  if (!success) return res.status(422).json({ error: 'invalid_arguments' });
  const order = await orders.findOwned(args.order_id, req.user.id);
  if (!order) return res.status(404).json({ error: 'not_found' });
  if (args.amount_cents > order.refundable_cents) return res.status(422).json({ error: 'amount_too_high' });
  if ((await pendingActions.countOpen(req.user.id)) >= MAX_OPEN_ACTIONS) {
    return res.status(429).json({ error: 'too_many_pending_actions' });
  }
  const action = await pendingActions.create({
    userId: req.user.id, type: 'issue_refund', params: args, expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return res.status(202).json({ status: 'pending_approval', action_id: action.id });
});

// Confirmed by the signed-in person in the app (session + CSRF); the agent's token is not accepted.
router.post('/actions/:id/confirm', requireHumanSession, async (req, res) => {
  const action = await pendingActions.claimOpen(req.params.id, req.user.id); // atomic: open -> confirmed, unexpired
  if (!action) return res.status(404).json({ error: 'not_found' });
  const refund = await refunds.issue(action.params, { userId: req.user.id, approvedActionId: action.id });
  return res.status(201).json({ refund_id: refund.id });
});
`,
    },
    fastapi: {
      note: 'claim_open() should flip status from open to confirmed in one UPDATE ... WHERE status = open AND expires_at > now().',
      code: `
from fastapi import APIRouter, Depends, HTTPException, Security

from .auth import current_app_session, require_scopes
from .domain import IssueRefundArgs, orders, pending_actions, refunds

router = APIRouter()


@router.post("/agent/tools/issue_refund", status_code=202)
def agent_issue_refund(args: IssueRefundArgs, user=Security(require_scopes, scopes=["agent:tools"])):
    # The agent's call only records a pending action; no money moves here.
    order = orders.get_owned(args.order_id, user.id)
    if order is None:
        raise HTTPException(404, "not_found")
    if args.amount_cents > order.refundable_cents:
        raise HTTPException(422, "amount_too_high")
    if pending_actions.count_open(user.id) >= 5:  # per-user cap on open actions
        raise HTTPException(429, "too_many_pending_actions")
    action = pending_actions.create(user.id, "issue_refund", args.model_dump(), ttl_minutes=15)
    return {"status": "pending_approval", "action_id": action.id}


@router.post("/actions/{action_id}/confirm", status_code=201)
def confirm_action(action_id: int, user=Depends(current_app_session)):
    # Browser session with a CSRF check only: the agent's bearer token cannot confirm.
    action = pending_actions.claim_open(action_id, user.id)  # atomic: open -> confirmed, unexpired
    if action is None:
        raise HTTPException(404, "not_found")
    refund = refunds.issue(**action.params, user_id=user.id, approved_action_id=action.id)
    return {"refund_id": refund.id}
`,
    },
    django: {
      note: 'Standard Django and DRF imports (APIView, Response, get_object_or_404, transaction, timezone, timedelta) are omitted for length.',
      code: `
class AgentIssueRefundView(APIView):
    """Agent tool endpoint: records a pending action and returns it. No money moves here."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        args = IssueRefundArgsSerializer(data=request.data)
        args.is_valid(raise_exception=True)
        order = get_object_or_404(Order, pk=args.validated_data["order_id"], owner=request.user)
        if args.validated_data["amount_cents"] > order.refundable_cents:
            return Response({"error": "amount_too_high"}, status=422)
        if PendingAction.objects.filter(user=request.user, status="open").count() >= 5:  # per-user cap
            return Response({"error": "too_many_pending_actions"}, status=429)
        action = PendingAction.objects.create(user=request.user, kind="issue_refund", params=args.validated_data,
                                              status="open", expires_at=timezone.now() + timedelta(minutes=15))
        return Response({"status": "pending_approval", "action_id": action.pk}, status=202)


class ConfirmActionView(APIView):
    authentication_classes = [SessionAuthentication]  # browser session + CSRF; agent tokens are refused
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        with transaction.atomic():
            action = get_object_or_404(PendingAction.objects.select_for_update(), pk=pk, user=request.user,
                                       status="open", expires_at__gt=timezone.now())
            action.status = "confirmed"
            action.save(update_fields=["status"])
            refund = issue_refund(user=request.user, approved_action=action, **action.params)
        return Response({"refund_id": refund.pk}, status=201)
`,
    },
    laravel: {
      note: 'Put the agent route behind auth:sanctum with an agent ability, and the confirm route behind the web guard only.',
      code: `
<?php
// Agent tool "issue_refund": records a pending action and returns it. No money moves here.
public function issueRefund(Request $request)
{
    $args = $request->validate([
        'order_id' => ['required', 'integer'],
        'amount_cents' => ['required', 'integer', 'min:1'],
    ]);
    $order = $request->user()->orders()->findOrFail($args['order_id']);
    abort_if($args['amount_cents'] > $order->refundable_cents, 422, 'Amount exceeds the refundable total.');
    abort_if($request->user()->pendingActions()->where('status', 'open')->count() >= 5, 429, 'Too many pending actions.');

    $action = $request->user()->pendingActions()->create([
        'kind' => 'issue_refund', 'params' => $args, 'status' => 'open', 'expires_at' => now()->addMinutes(15),
    ]);
    return response()->json(['status' => 'pending_approval', 'action_id' => $action->id], 202);
}

// Confirmed by the signed-in person in the web app (web guard + CSRF); agent tokens are not accepted.
public function confirm(Request $request, int $id)
{
    $refund = DB::transaction(function () use ($request, $id) {
        $action = $request->user()->pendingActions()->whereKey($id)->where('status', 'open')
            ->where('expires_at', '>', now())->lockForUpdate()->firstOrFail();
        $action->forceFill(['status' => 'confirmed'])->save();
        return $this->refunds->issue($request->user(), $action->params, approvedAction: $action);
    });

    return response()->json(['refund_id' => $refund->id], 201);
}
`,
    },
    spring: {
      note: 'findOpenForUpdate is a repository query with @Lock(PESSIMISTIC_WRITE) that matches status open and an unexpired action.',
      code: `
// Agent tool "issue_refund": records a pending action and returns it. No money moves here.
@PostMapping("/agent/tools/issue_refund")
@PreAuthorize("hasAuthority('SCOPE_agent:tools')")
ResponseEntity<Map<String, Object>> agentIssueRefund(@Valid @RequestBody IssueRefundArgs args,
                                                     @AuthenticationPrincipal Jwt jwt) {
    String userId = jwt.getSubject();
    Order order = orders.findByIdAndOwnerId(args.orderId(), userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (args.amountCents() > order.getRefundableCents()) {
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "amount_too_high");
    }
    if (pendingActions.countByUserIdAndStatus(userId, "open") >= 5) { // per-user cap on open actions
        throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "too_many_pending_actions");
    }
    PendingAction action = pendingActions.save(
            PendingAction.open(userId, "issue_refund", args, Instant.now().plus(Duration.ofMinutes(15))));
    return ResponseEntity.accepted().body(Map.of("status", "pending_approval", "actionId", action.getId()));
}

// Lives on the session-based /app filter chain (form login + CSRF); agent bearer tokens are not accepted there.
@PostMapping("/app/actions/{id}/confirm")
@Transactional
ResponseEntity<Map<String, Object>> confirm(@PathVariable long id, Principal principal) {
    PendingAction action = pendingActions.findOpenForUpdate(id, principal.getName(), Instant.now())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    action.markConfirmed();
    Refund refund = refunds.issue(action.getParams(IssueRefundArgs.class), principal.getName(), action.getId());
    return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("refundId", refund.getId()));
}
`,
    },
  }),

  'prompt-guard': family({
    express: {
      note: 'Shown with the Anthropic SDK (npm install @anthropic-ai/sdk); the same four controls apply to any model provider.',
      code: `
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { requireAuth } from './auth.js';
import { assistantLimiter } from './limits.js';

const anthropic = new Anthropic(); // the API key stays on the server (ANTHROPIC_API_KEY)
const MAX_INPUT_CHARS = 4000;
// The system prompt lives here; the client cannot send, read or override it.
const SYSTEM_PROMPT = 'You answer questions about the signed-in customer orders and invoices.';
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+/g;
const CARD = /(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/g;

export const router = express.Router();

router.post('/assistant', requireAuth, assistantLimiter, async (req, res) => {
  const text = req.body?.message;
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_INPUT_CHARS) {
    return res.status(422).json({ error: 'message_must_be_1_to_4000_chars' });
  }
  // Only the user's text is forwarded; body.system, body.model and body.max_tokens are ignored.
  const reply = await anthropic.messages.create({
    model: 'claude-opus-5-5', // chosen on the server
    max_tokens: 2048, // hard cap on output cost
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text.replace(EMAIL, '[email]').replace(CARD, '[card]') }],
  });
  const answer = reply.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return res.json({ answer });
});
`,
    },
    fastapi: {
      note: 'Shown with the Anthropic SDK (pip install anthropic); the same four controls apply to any model provider.',
      code: `
import re

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from .deps import current_user

client = AsyncAnthropic()  # the API key stays on the server (ANTHROPIC_API_KEY)
SYSTEM_PROMPT = "You answer questions about the signed-in customer's orders and invoices."  # server-side only
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+")
CARD = re.compile(r"(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])")
router = APIRouter()


class AssistantIn(BaseModel):
    model_config = ConfigDict(extra="forbid")  # system, model or max_tokens from the client: 422
    message: str = Field(min_length=1, max_length=4000)


@router.post("/assistant", dependencies=[Depends(current_user)])
async def assistant(body: AssistantIn):
    redacted = CARD.sub("[card]", EMAIL.sub("[email]", body.message))
    reply = await client.messages.create(
        model="claude-opus-5-5",  # chosen on the server
        max_tokens=2048,  # hard cap on output cost
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": redacted}],
    )
    return {"answer": "".join(b.text for b in reply.content if b.type == "text")}
`,
    },
    django: {
      note: 'Shown with the Anthropic SDK (pip install anthropic); keep the default IsAuthenticated permission and add a throttle scope.',
      code: `
import re

import anthropic
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

client = anthropic.Anthropic()  # the API key stays on the server (ANTHROPIC_API_KEY)
SYSTEM_PROMPT = "You answer questions about the signed-in customer's orders and invoices."  # server-side only
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+")
CARD = re.compile(r"(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])")


class AssistantSerializer(serializers.Serializer):
    message = serializers.CharField(min_length=1, max_length=4000)  # the only field read


@api_view(["POST"])
def assistant(request):
    data = AssistantSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    redacted = CARD.sub("[card]", EMAIL.sub("[email]", data.validated_data["message"]))
    # system, model and max_tokens are fixed here; anything else in the request is ignored.
    reply = client.messages.create(
        model="claude-opus-5-5",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": redacted}],
    )
    return Response({"answer": "".join(b.text for b in reply.content if b.type == "text")})
`,
    },
    laravel: {
      note: 'Shown with the Anthropic PHP SDK (composer require anthropic-ai/sdk); bind its Client as a singleton in a service provider.',
      code: `
<?php
// app/Http/Controllers/AssistantController.php

use Anthropic\\Client;
use Illuminate\\Http\\Request;

public function ask(Request $request, Client $anthropic)
{
    // Only "message" is read; system, model and max_tokens from the client are ignored.
    $message = $request->validate(['message' => ['required', 'string', 'max:4000']])['message'];

    // Redact obvious PII before it leaves your infrastructure.
    $redacted = preg_replace(
        ['/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+/', '/(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/'],
        ['[email]', '[card]'],
        $message,
    );

    $reply = $anthropic->messages->create(
        model: 'claude-opus-5-5',                   // chosen on the server
        maxTokens: 2048,                            // hard cap on output cost
        system: config('assistant.system_prompt'),  // stored server-side, never sent by the client
        messages: [['role' => 'user', 'content' => $redacted]],
    );

    $answer = collect($reply->content)->where('type', 'text')->pluck('text')->implode('');
    return response()->json(['answer' => $answer]);
}
`,
    },
    spring: {
      note: 'Shown with the Anthropic Java SDK (com.anthropic:anthropic-java); imports are omitted for length.',
      code: `
private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:[.][A-Za-z0-9-]+)+");
private static final Pattern CARD = Pattern.compile("(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])");
// The system prompt lives on the server; the client cannot send, read or override it.
private static final String SYSTEM_PROMPT = "You answer questions about the signed-in customer's orders and invoices.";
private final AnthropicClient anthropic = AnthropicOkHttpClient.fromEnv(); // the API key stays on the server

record AssistantRequest(@NotBlank @Size(max = 4000) String message) {} // the only field accepted

@PostMapping("/assistant")
Map<String, String> ask(@Valid @RequestBody AssistantRequest body) {
    String redacted = CARD.matcher(EMAIL.matcher(body.message()).replaceAll("[email]")).replaceAll("[card]");
    MessageCreateParams params = MessageCreateParams.builder()
            .model("claude-opus-5-5") // chosen on the server
            .maxTokens(2048L)         // hard cap on output cost
            .system(SYSTEM_PROMPT)
            .addUserMessage(redacted)
            .build();
    Message reply = anthropic.messages().create(params);
    String answer = reply.content().stream()
            .flatMap(block -> block.text().stream())
            .map(TextBlock::text)
            .collect(Collectors.joining());
    return Map.of("answer", answer);
}
`,
    },
  }),

  'output-encoding': family({
    express: {
      note: 'npm install marked sanitize-html; in the browser, DOMPurify with the same rules does the same job.',
      code: `
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const LINK_HOSTS = new Set(['example.com', 'docs.example.com']);

// Plain-text display: escape everything the model wrote.
export const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function isAllowedLink(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && LINK_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

// Markdown display: model output is untrusted. No images (they can leak data
// through their URL), and links survive only for allow-listed https hosts.
export function renderModelMarkdown(markdown) {
  return sanitizeHtml(marked.parse(markdown, { async: false }), {
    allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a'],
    allowedAttributes: { a: ['href', 'rel'] },
    allowedSchemes: ['https'],
    exclusiveFilter: (frame) => frame.tag === 'a' && !isAllowedLink(frame.attribs.href ?? ''),
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }) },
  });
}
`,
    },
    fastapi: {
      note: 'pip install nh3 markdown-it-py; return the cleaned HTML and never re-insert the raw model text.',
      code: `
import html
from urllib.parse import urlsplit

import nh3
from markdown_it import MarkdownIt

LINK_HOSTS = {"example.com", "docs.example.com"}
ALLOWED_TAGS = {"p", "br", "strong", "em", "code", "pre", "ul", "ol", "li", "blockquote", "a"}
md = MarkdownIt("commonmark", {"html": False})  # raw HTML in the model output is escaped, not passed on


def render_model_text(text: str) -> str:
    return html.escape(text)  # plain-text display: escape everything the model wrote


def keep_allowed_links(tag: str, attr: str, value: str) -> str | None:
    if tag == "a" and attr == "href":
        url = urlsplit(value)
        return value if url.scheme == "https" and url.hostname in LINK_HOSTS else None
    return value


def render_model_markdown(text: str) -> str:
    # Model output is untrusted: img is not an allowed tag, so images (which can leak data
    # through their URL) are dropped, and links keep their href only for allow-listed hosts.
    return nh3.clean(md.render(text), tags=ALLOWED_TAGS, attributes={"a": {"href"}},
                     attribute_filter=keep_allowed_links, url_schemes={"https"},
                     link_rel="noopener noreferrer nofollow")
`,
    },
    django: {
      note: 'pip install nh3 markdown-it-py; in templates, {{ answer }} autoescapes, so never add |safe to raw model text.',
      code: `
from urllib.parse import urlsplit

import nh3
from django.utils.html import escape
from django.utils.safestring import mark_safe
from markdown_it import MarkdownIt

LINK_HOSTS = {"example.com", "docs.example.com"}
md = MarkdownIt("commonmark", {"html": False})  # raw HTML in the model output is escaped


def render_model_text(text: str) -> str:
    return escape(text)  # plain-text display: escape everything the model wrote


def keep_allowed_links(tag: str, attr: str, value: str) -> str | None:
    if tag == "a" and attr == "href":
        url = urlsplit(value)
        return value if url.scheme == "https" and url.hostname in LINK_HOSTS else None
    return value


def render_model_markdown(text: str):
    # Model output is untrusted: images are dropped (img is not allowed) and links keep
    # their href only for allow-listed https hosts. mark_safe only after nh3 has cleaned it.
    cleaned = nh3.clean(md.render(text), tags={"p", "br", "strong", "em", "code", "pre", "ul", "ol", "li", "a"},
                        attributes={"a": {"href"}}, attribute_filter=keep_allowed_links,
                        url_schemes={"https"}, link_rel="noopener noreferrer nofollow")
    return mark_safe(cleaned)
`,
    },
    laravel: {
      note: 'league/commonmark ships with Laravel; for plain text, {{ $answer }} in Blade escapes it, so never use {!! !!} on model output.',
      code: `
<?php

use League\\CommonMark\\Environment\\Environment;
use League\\CommonMark\\Event\\DocumentParsedEvent;
use League\\CommonMark\\Extension\\CommonMark\\CommonMarkCoreExtension;
use League\\CommonMark\\Extension\\CommonMark\\Node\\Inline\\Image;
use League\\CommonMark\\Extension\\CommonMark\\Node\\Inline\\Link;
use League\\CommonMark\\MarkdownConverter;

function renderModelMarkdown(string $markdown, array $linkHosts = ['example.com', 'docs.example.com']): string
{
    // Raw HTML in the model output is escaped; javascript: and data: links are removed.
    $environment = new Environment(['html_input' => 'escape', 'allow_unsafe_links' => false]);
    $environment->addExtension(new CommonMarkCoreExtension());
    $environment->addEventListener(DocumentParsedEvent::class, function (DocumentParsedEvent $event) use ($linkHosts) {
        foreach (iterator_to_array($event->getDocument()->iterator(), false) as $node) {
            if ($node instanceof Image) {
                $node->detach(); // images can leak data through their URL
            } elseif ($node instanceof Link && (! str_starts_with($node->getUrl(), 'https://')
                || ! in_array(parse_url($node->getUrl(), PHP_URL_HOST), $linkHosts, true))) {
                foreach ($node->children() as $child) {
                    $node->insertBefore($child); // keep the link text, drop the link
                }
                $node->detach();
            }
        }
    });

    return (string) (new MarkdownConverter($environment))->convert($markdown);
}
`,
    },
    spring: {
      note: 'Uses org.commonmark:commonmark; imports are omitted for length.',
      code: `
private static final Set<String> LINK_HOSTS = Set.of("example.com", "docs.example.com");
private final Parser parser = Parser.builder().build();
// escapeHtml: raw HTML in the model output is escaped; sanitizeUrls: javascript: URLs are neutralised.
private final HtmlRenderer renderer = HtmlRenderer.builder().escapeHtml(true).sanitizeUrls(true).build();

// Plain-text display: HtmlUtils.htmlEscape(answer), or th:text in Thymeleaf (never th:utext).
String renderModelMarkdown(String markdown) {
    Node document = parser.parse(markdown);
    List<Node> drop = new ArrayList<>();
    document.accept(new AbstractVisitor() {
        @Override
        public void visit(Image image) { drop.add(image); } // images can leak data through their URL
        @Override
        public void visit(Link link) {
            if (!isAllowedLink(link.getDestination())) drop.add(link);
            visitChildren(link);
        }
    });
    drop.forEach(Node::unlink);
    return renderer.render(document);
}

private static boolean isAllowedLink(String href) {
    try {
        URI uri = new URI(href);
        return "https".equals(uri.getScheme()) && LINK_HOSTS.contains(uri.getHost());
    } catch (URISyntaxException e) {
        return false;
    }
}
`,
    },
  }),
};

// ---------- rule id -> fix family ----------

const RULES_BY_FIX: Record<FixKey, readonly string[]> = {
  ownership: ['API1-OWNERSHIP', 'TOOL-ID-PARAM'],
  'require-auth': ['API2-PUBLIC-OP', 'API2-NO-SCHEME', 'API2-KEY-IN-QUERY', 'API2-STATIC-KEY', 'REL-NEW-PUBLIC', 'REL-AUTH-REMOVED'],
  'require-scope': ['API2-BROAD-SCOPE', 'API5-ADMIN-PATH', 'REL-SCOPE-REDUCED', 'JWT-BROAD-SCOPE', 'AGENT-SCOPES'],
  'response-allowlist': ['API3-SENSITIVE-OUT', 'REL-NEW-SENSITIVE'],
  'input-allowlist': ['API3-MASS-ASSIGNMENT', 'API3-OPEN-BODY', 'TOOL-SCHEMA-OPEN', 'REL-BODY-OPENED'],
  'page-limit': ['API4-NO-PAGING', 'API4-NO-MAX'],
  'upload-limit': ['API4-UPLOAD'],
  'rate-limit': ['API2-LOGIN-RATE', 'API4-NO-429', 'HDR-NO-RATELIMIT', 'LLM-COST-LIMIT', 'REL-LIMIT-REMOVED', 'AGENT-LIMITS'],
  idempotency: ['API6-BUSINESS-FLOW'],
  'ssrf-guard': ['API7-URL-INPUT', 'TOOL-URL-PARAM', 'AGENT-EGRESS'],
  'path-guard': ['TOOL-PATH-PARAM'],
  'error-handler': ['API8-ERROR-DETAIL', 'ERR-STACK'],
  'security-headers': [
    'API8-PLAIN-HTTP', 'HDR-NO-HSTS', 'HDR-SHORT-HSTS', 'HDR-NO-NOSNIFF', 'HDR-NO-CSP',
    'HDR-WEAK-CSP', 'HDR-NO-FRAME', 'HDR-VERSION-LEAK', 'HDR-CACHEABLE',
  ],
  'cors-allowlist': ['CORS-WILDCARD-CREDS', 'CORS-WILDCARD', 'CORS-NULL', 'CORS-REFLECTED', 'CORS-NO-VARY', 'CORS-METHODS'],
  'cookie-flags': ['COOKIE-FLAGS', 'COOKIE-SAMESITE-NONE'],
  'jwt-verify': [
    'JWT-NO-SIGNATURE', 'JWT-SHARED-SECRET', 'JWT-KEY-IN-HEADER', 'JWT-ODD-KID', 'JWT-NO-EXP',
    'JWT-LONG-LIFE', 'JWT-NO-AUD', 'JWT-NO-ISS', 'JWT-SENSITIVE-CLAIMS',
  ],
  'agent-approval': ['TOOL-NEEDS-APPROVAL', 'TOOL-NO-ANNOTATIONS', 'AGENT-APPROVAL'],
  'prompt-guard': ['LLM-INPUT-LIMIT', 'LLM-CLIENT-INSTRUCTIONS', 'LLM-PII-IN', 'LLM-MODEL-CHOICE'],
  'output-encoding': ['LLM-RAW-OUTPUT'],
};

const FIX_BY_RULE = new Map<string, FixKey>();
for (const key of Object.keys(RULES_BY_FIX) as FixKey[]) {
  for (const rule of RULES_BY_FIX[key]) FIX_BY_RULE.set(rule, key);
}

/** The fix family for a finding's rule id, or null when the rule has no code fix. Ids match exactly. */
export function fixKeyForRule(rule: string): FixKey | null {
  return FIX_BY_RULE.get(rule) ?? null;
}

/** The fix snippet for a finding's rule id in one framework, or null when the rule has no code fix. */
export function fixFor(rule: string, framework: Framework): FixSnippet | null {
  const key = fixKeyForRule(rule);
  return key ? FIXES[key][framework] : null;
}
