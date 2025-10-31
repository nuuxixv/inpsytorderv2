CREATE TABLE public.products (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    product_code text,
    category text,
    sub_category text,
    name text,
    list_price numeric,
    notes text,
    is_discountable boolean DEFAULT FALSE,
    CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE SEQUENCE public.products_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);