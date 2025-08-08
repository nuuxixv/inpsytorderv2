CREATE TABLE public.orders (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    customer_name text,
    customer_email text,
    status text,
    event_id bigint,
    final_payment numeric,
    CONSTRAINT orders_pkey PRIMARY KEY (id),
    CONSTRAINT orders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

CREATE SEQUENCE public.orders_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);