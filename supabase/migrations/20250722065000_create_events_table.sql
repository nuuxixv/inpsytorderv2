CREATE TABLE public.events (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    start_date date,
    end_date date,
    order_url_slug text,
    CONSTRAINT events_pkey PRIMARY KEY (id),
    CONSTRAINT events_order_url_slug_key UNIQUE (order_url_slug)
);

CREATE SEQUENCE public.events_id_seq
    AS bigint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);