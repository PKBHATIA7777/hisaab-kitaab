--
-- PostgreSQL database dump
--


-- Dumped from database version 17.10 (9f6157c)
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.settlement_records DROP CONSTRAINT IF EXISTS settlement_records_to_member_id_fkey;
ALTER TABLE IF EXISTS ONLY public.settlement_records DROP CONSTRAINT IF EXISTS settlement_records_marked_by_fkey;
ALTER TABLE IF EXISTS ONLY public.settlement_records DROP CONSTRAINT IF EXISTS settlement_records_from_member_id_fkey;
ALTER TABLE IF EXISTS ONLY public.settlement_records DROP CONSTRAINT IF EXISTS settlement_records_event_id_fkey;
ALTER TABLE IF EXISTS ONLY public.settlement_records DROP CONSTRAINT IF EXISTS settlement_records_chapter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.friends DROP CONSTRAINT IF EXISTS friends_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expenses DROP CONSTRAINT IF EXISTS expenses_source_member_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expenses DROP CONSTRAINT IF EXISTS expenses_source_chapter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expenses DROP CONSTRAINT IF EXISTS expenses_payer_member_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expenses DROP CONSTRAINT IF EXISTS expenses_event_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expenses DROP CONSTRAINT IF EXISTS expenses_chapter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expenses DROP CONSTRAINT IF EXISTS expenses_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expense_splits DROP CONSTRAINT IF EXISTS expense_splits_member_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expense_splits DROP CONSTRAINT IF EXISTS expense_splits_expense_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expense_categories DROP CONSTRAINT IF EXISTS expense_categories_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.events DROP CONSTRAINT IF EXISTS events_chapter_id_fkey;
ALTER TABLE IF EXISTS ONLY public.device_sessions DROP CONSTRAINT IF EXISTS device_sessions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapters DROP CONSTRAINT IF EXISTS chapters_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.chapter_members DROP CONSTRAINT IF EXISTS chapter_members_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapter_members DROP CONSTRAINT IF EXISTS chapter_members_friend_id_fkey;
ALTER TABLE IF EXISTS ONLY public.chapter_members DROP CONSTRAINT IF EXISTS chapter_members_chapter_id_fkey;
DROP TRIGGER IF EXISTS trg_settlements_update_chapter ON public.settlement_records;
DROP TRIGGER IF EXISTS trg_expenses_update_chapter ON public.expenses;
DROP INDEX IF EXISTS public.users_username_key;
DROP INDEX IF EXISTS public.users_email_key;
DROP INDEX IF EXISTS public.otps_email_purpose_unique;
DROP INDEX IF EXISTS public.idx_users_username;
DROP INDEX IF EXISTS public.idx_users_jwt_gen;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_settlement_records_to;
DROP INDEX IF EXISTS public.idx_settlement_records_from;
DROP INDEX IF EXISTS public.idx_settlement_records_event;
DROP INDEX IF EXISTS public.idx_settlement_records_chapter_status;
DROP INDEX IF EXISTS public.idx_settlement_records_chapter;
DROP INDEX IF EXISTS public.idx_refresh_tokens_user;
DROP INDEX IF EXISTS public.idx_refresh_tokens_hash;
DROP INDEX IF EXISTS public.idx_otps_email_purpose;
DROP INDEX IF EXISTS public.idx_otps_email;
DROP INDEX IF EXISTS public.idx_friends_user_id;
DROP INDEX IF EXISTS public.idx_expenses_event_id;
DROP INDEX IF EXISTS public.idx_expenses_chapter_id;
DROP INDEX IF EXISTS public.idx_expenses_chapter_date;
DROP INDEX IF EXISTS public.idx_expenses_chapter_created;
DROP INDEX IF EXISTS public.idx_expense_splits_member_id;
DROP INDEX IF EXISTS public.idx_expense_categories_user;
DROP INDEX IF EXISTS public.idx_events_chapter_status;
DROP INDEX IF EXISTS public.idx_events_chapter_id;
DROP INDEX IF EXISTS public.idx_device_sessions_user_active;
DROP INDEX IF EXISTS public.idx_device_sessions_user;
DROP INDEX IF EXISTS public.idx_device_sessions_session_id;
DROP INDEX IF EXISTS public.idx_chapters_data_updated;
DROP INDEX IF EXISTS public.idx_chapters_created_by;
DROP INDEX IF EXISTS public.idx_chapter_members_user_id;
DROP INDEX IF EXISTS public.idx_chapter_members_user_chapter;
DROP INDEX IF EXISTS public.idx_chapter_members_friend_id;
DROP INDEX IF EXISTS public.idx_chapter_members_chapter_id;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.friends DROP CONSTRAINT IF EXISTS unique_user_friend_username;
ALTER TABLE IF EXISTS ONLY public.expense_categories DROP CONSTRAINT IF EXISTS unique_category_per_user;
ALTER TABLE IF EXISTS ONLY public.settlement_records DROP CONSTRAINT IF EXISTS settlement_records_pkey;
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.refresh_tokens DROP CONSTRAINT IF EXISTS refresh_tokens_pkey;
ALTER TABLE IF EXISTS ONLY public.otps DROP CONSTRAINT IF EXISTS otps_pkey;
ALTER TABLE IF EXISTS ONLY public.friends DROP CONSTRAINT IF EXISTS friends_pkey;
ALTER TABLE IF EXISTS ONLY public.expenses DROP CONSTRAINT IF EXISTS expenses_pkey;
ALTER TABLE IF EXISTS ONLY public.expense_splits DROP CONSTRAINT IF EXISTS expense_splits_pkey;
ALTER TABLE IF EXISTS ONLY public.expense_categories DROP CONSTRAINT IF EXISTS expense_categories_pkey;
ALTER TABLE IF EXISTS ONLY public.events DROP CONSTRAINT IF EXISTS events_pkey;
ALTER TABLE IF EXISTS ONLY public.device_sessions DROP CONSTRAINT IF EXISTS device_sessions_session_id_key;
ALTER TABLE IF EXISTS ONLY public.device_sessions DROP CONSTRAINT IF EXISTS device_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.chapters DROP CONSTRAINT IF EXISTS chapters_pkey;
ALTER TABLE IF EXISTS ONLY public.chapter_members DROP CONSTRAINT IF EXISTS chapter_members_pkey;
ALTER TABLE IF EXISTS public.settlement_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.refresh_tokens ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.friends ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.expense_categories ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.device_sessions ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP SEQUENCE IF EXISTS public.settlement_records_id_seq;
DROP TABLE IF EXISTS public.settlement_records;
DROP SEQUENCE IF EXISTS public.refresh_tokens_id_seq;
DROP TABLE IF EXISTS public.refresh_tokens;
DROP TABLE IF EXISTS public.otps;
DROP SEQUENCE IF EXISTS public.otps_id_seq;
DROP SEQUENCE IF EXISTS public.friends_id_seq;
DROP TABLE IF EXISTS public.friends;
DROP TABLE IF EXISTS public.expenses;
DROP SEQUENCE IF EXISTS public.expenses_id_seq;
DROP TABLE IF EXISTS public.expense_splits;
DROP SEQUENCE IF EXISTS public.expense_splits_id_seq;
DROP SEQUENCE IF EXISTS public.expense_categories_id_seq;
DROP TABLE IF EXISTS public.expense_categories;
DROP SEQUENCE IF EXISTS public.events_id_seq;
DROP TABLE IF EXISTS public.events;
DROP SEQUENCE IF EXISTS public.device_sessions_id_seq;
DROP TABLE IF EXISTS public.device_sessions;
DROP TABLE IF EXISTS public.chapters;
DROP SEQUENCE IF EXISTS public.chapters_id_seq;
DROP TABLE IF EXISTS public.chapter_members;
DROP SEQUENCE IF EXISTS public.chapter_members_id_seq;
DROP FUNCTION IF EXISTS public.update_chapter_data_timestamp();
--
-- Name: update_chapter_data_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_chapter_data_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      UPDATE chapters 
      SET data_updated_at = NOW() 
      WHERE id = COALESCE(NEW.chapter_id, OLD.chapter_id);
      RETURN COALESCE(NEW, OLD);
    END;
    $$;


--
-- Name: chapter_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chapter_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chapter_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_members (
    id integer DEFAULT nextval('public.chapter_members_id_seq'::regclass) NOT NULL,
    chapter_id integer,
    member_name character varying(100) NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer,
    friend_id integer
);


--
-- Name: chapters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chapters_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapters (
    id integer DEFAULT nextval('public.chapters_id_seq'::regclass) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(50),
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_opened_at timestamp without time zone,
    is_archived boolean DEFAULT false,
    is_personal boolean DEFAULT false,
    data_updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: device_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_sessions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    session_id character varying(64) NOT NULL,
    device_name character varying(255),
    device_type character varying(50),
    browser character varying(100),
    os character varying(100),
    ip_address character varying(50),
    last_active_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    is_current boolean DEFAULT false,
    jwt_iat integer
);


--
-- Name: device_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_sessions_id_seq OWNED BY public.device_sessions.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id integer NOT NULL,
    chapter_id integer,
    name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id integer NOT NULL,
    user_id integer,
    name character varying(50) NOT NULL,
    color character varying(7) DEFAULT '#888888'::character varying,
    icon character varying(10) DEFAULT '📦'::character varying,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_categories_id_seq OWNED BY public.expense_categories.id;


--
-- Name: expense_splits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_splits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_splits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_splits (
    id integer DEFAULT nextval('public.expense_splits_id_seq'::regclass) NOT NULL,
    expense_id integer,
    member_id integer,
    amount_owed numeric(12,2) DEFAULT 0 NOT NULL
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer DEFAULT nextval('public.expenses_id_seq'::regclass) NOT NULL,
    chapter_id integer,
    payer_member_id integer,
    amount numeric(12,2) NOT NULL,
    description character varying(100),
    expense_date timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    event_id integer,
    source_chapter_id integer,
    source_member_id integer,
    is_synced_from_chapter boolean DEFAULT false,
    sync_consumed_snapshot numeric(12,2),
    sync_dismissed boolean DEFAULT false,
    category_id integer,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: friends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friends (
    id integer NOT NULL,
    user_id integer,
    name character varying(100) NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    mobile character varying(20),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: friends_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.friends_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: friends_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.friends_id_seq OWNED BY public.friends.id;


--
-- Name: otps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otps (
    id integer DEFAULT nextval('public.otps_id_seq'::regclass) NOT NULL,
    email text NOT NULL,
    code text NOT NULL,
    purpose text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    attempts integer DEFAULT 0
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(128) NOT NULL,
    device_hint character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone NOT NULL,
    last_used_at timestamp without time zone DEFAULT now(),
    revoked boolean DEFAULT false
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: settlement_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settlement_records (
    id integer NOT NULL,
    chapter_id integer NOT NULL,
    event_id integer,
    from_member_id integer NOT NULL,
    to_member_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    marked_by integer,
    note character varying(200),
    status character varying(20) DEFAULT 'settled'::character varying,
    marked_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT settlement_records_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: settlement_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.settlement_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: settlement_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.settlement_records_id_seq OWNED BY public.settlement_records.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer DEFAULT nextval('public.users_id_seq'::regclass) NOT NULL,
    real_name text NOT NULL,
    username text,
    email text NOT NULL,
    password_hash text,
    provider text DEFAULT 'local'::text NOT NULL,
    google_id text,
    last_login_at timestamp with time zone,
    needs_password boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    jwt_generation integer DEFAULT 0 NOT NULL
);


--
-- Name: device_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions ALTER COLUMN id SET DEFAULT nextval('public.device_sessions_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: expense_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories ALTER COLUMN id SET DEFAULT nextval('public.expense_categories_id_seq'::regclass);


--
-- Name: friends id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends ALTER COLUMN id SET DEFAULT nextval('public.friends_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: settlement_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_records ALTER COLUMN id SET DEFAULT nextval('public.settlement_records_id_seq'::regclass);


--
-- Data for Name: chapter_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chapter_members (id, chapter_id, member_name, added_at, user_id, friend_id) FROM stdin;
4	2	riya	2025-12-18 18:50:46.440041	\N	\N
5	2	hu	2025-12-18 18:50:46.440041	\N	\N
6	2	hu	2025-12-18 18:50:46.440041	\N	\N
7	3	mai	2025-12-19 16:03:44.174079	\N	\N
8	3	mera bhai	2025-12-19 16:03:44.174079	\N	\N
9	3	mere bhai ka bhai	2025-12-19 16:03:44.174079	\N	\N
10	4	Garv	2025-12-20 09:31:26.495241	\N	\N
11	4	Part	2025-12-20 09:31:26.495241	\N	\N
12	4	Ria	2025-12-20 09:31:26.495241	\N	\N
13	4	Pvni	2025-12-20 09:31:26.495241	\N	\N
14	5	Garv Behl	2025-12-21 18:55:11.529416	19	\N
15	5	Parth	2025-12-21 18:55:11.529416	\N	\N
16	5	Golu	2025-12-21 18:55:11.529416	\N	\N
17	5	Riya	2025-12-21 18:55:11.529416	\N	\N
18	5	Pavani	2025-12-21 18:55:11.529416	\N	\N
19	6	Garv Behl	2025-12-21 18:57:53.152979	19	\N
20	6	Eddy	2025-12-21 18:57:53.152979	\N	\N
21	6	Parth	2025-12-21 18:57:53.152979	\N	\N
22	6	Lakshay	2025-12-21 18:57:53.152979	\N	\N
33	9	Parth Bhatia	2025-12-22 18:43:42.886524	17	\N
34	9	Golu	2025-12-22 18:43:42.886524	\N	\N
35	9	Riya	2025-12-22 18:43:42.886524	\N	\N
36	9	Pavani	2025-12-22 18:43:42.886524	\N	\N
37	10	Parth Bhatia	2025-12-23 06:40:42.254621	17	\N
38	10	Garv	2025-12-23 06:40:42.254621	\N	\N
39	10	Ria	2025-12-23 06:40:42.254621	\N	\N
40	10	Pvni	2025-12-23 06:40:42.254621	\N	\N
41	11	Parth Bhatia	2025-12-31 11:41:56.794249	17	\N
42	11	Archit	2025-12-31 11:41:56.794249	\N	\N
43	11	Garv Behl	2025-12-31 11:41:56.794249	\N	\N
44	11	ALI	2025-12-31 11:41:56.794249	\N	\N
50	13	Parth Bhatia	2026-01-01 15:26:41.677121	17	\N
51	13	Akshat	2026-01-01 15:26:41.677121	\N	\N
52	13	Kk	2026-01-01 15:26:41.677121	\N	\N
53	13	Tanmay	2026-01-01 15:26:41.677121	\N	\N
54	14	Parth Bhatia	2026-01-01 16:29:15.450182	17	\N
55	14	krish	2026-01-01 16:29:15.450182	\N	6
58	16	Parth Bhatia	2026-01-03 15:13:55.772804	17	\N
59	16	Archit	2026-01-03 15:13:55.772804	\N	3
60	17	Parth Bhatia	2026-01-11 10:30:16.743608	17	\N
61	17	Garv Behl	2026-01-11 10:30:16.743608	\N	1
62	18	Parth Bhatia	2026-01-18 10:21:35.568922	17	\N
63	18	Archit	2026-01-18 10:21:35.568922	\N	3
64	19	Dev Jain	2026-02-02 07:53:05.72752	21	\N
65	19	Parth	2026-02-02 07:53:05.72752	\N	\N
66	19	Garv	2026-02-02 07:53:05.72752	\N	\N
67	20	Parth Bhatia	2026-02-09 15:38:32.577047	17	\N
68	20	Garv Behl	2026-02-09 15:38:32.577047	\N	1
69	21	Parth Bhatia	2026-02-13 12:21:45.623022	17	\N
71	22	Parth Bhatia	2026-02-23 15:49:53.55452	17	\N
72	22	Adarsh	2026-02-23 15:49:53.55452	\N	\N
73	22	Om	2026-02-23 15:49:53.55452	\N	\N
74	23	Parth Bhatia	2026-04-08 14:42:02.440539	17	\N
75	23	Garv Behl	2026-04-08 14:42:02.440539	\N	1
76	24	Adarsh Kr Thakur	2026-04-10 09:28:40.809206	23	\N
77	24	Parth	2026-04-10 09:28:40.809206	\N	\N
79	26	Parth Bhatia	2026-04-23 05:50:37.189189	17	\N
80	26	Adarsh	2026-04-23 05:50:37.189189	\N	\N
81	26	Vansh	2026-04-23 05:50:37.189189	\N	\N
82	26	Sahayak	2026-04-23 05:50:37.189189	\N	\N
83	26	Navpreet	2026-04-23 05:50:37.189189	\N	\N
84	26	Navkaran	2026-04-23 05:50:37.189189	\N	\N
85	26	Sai	2026-04-23 05:50:37.189189	\N	\N
86	26	Nayab	2026-04-23 05:50:37.189189	\N	\N
87	26	Prateek	2026-04-23 05:50:37.189189	\N	\N
88	27	Navpreet Singh	2026-05-02 16:35:23.048337	25	\N
89	27	Prateek	2026-05-02 16:35:23.048337	\N	\N
90	27	Parth	2026-05-02 16:35:23.048337	\N	\N
91	28	Parth Bhatia	2026-05-04 17:31:59.356451	17	\N
92	29	Navpreet Singh	2026-05-07 06:52:50.501287	25	\N
93	30	Parth Bhatia	2026-05-07 14:53:16.055173	17	\N
94	30	joseph	2026-05-07 14:53:16.055173	\N	\N
95	31	Mystify Official	2026-05-13 07:58:38.941484	18	\N
96	32	Garv	2026-05-14 06:10:35.761517	26	\N
99	35	Parth Bhatia	2026-05-26 13:04:12.18577	17	\N
100	35	Navpreet	2026-05-26 13:04:12.18577	\N	\N
101	35	Sayak	2026-05-26 13:04:12.18577	\N	\N
102	35	Vansh	2026-05-26 13:04:12.18577	\N	\N
103	35	Rishvanth	2026-05-26 13:04:12.18577	\N	\N
104	35	Prateek	2026-05-26 13:04:12.18577	\N	\N
105	35	Navkaran	2026-05-26 13:04:12.18577	\N	\N
106	35	Aakash	2026-05-26 13:04:12.18577	\N	\N
107	35	Yuvraj	2026-05-26 13:04:12.18577	\N	\N
108	35	Sanjay	2026-05-26 13:04:12.18577	\N	\N
109	35	Abhishek	2026-05-26 13:04:12.18577	\N	\N
110	3	76	2026-05-26 15:32:04.822557	\N	\N
111	35	sujoy	2026-05-26 15:34:37.823204	\N	\N
112	35	nayab	2026-05-26 15:35:21.990789	\N	\N
113	30	Bhsi	2026-05-28 15:53:50.178232	\N	\N
114	36	Sayak Mukherjee	2026-05-29 07:48:14.776892	27	\N
115	37	Pratik Mishra	2026-06-11 11:00:53.840592	28	\N
116	38	Abishek R	2026-06-11 12:55:27.487282	29	\N
\.


--
-- Data for Name: chapters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chapters (id, name, description, created_by, created_at, last_opened_at, is_archived, is_personal, data_updated_at) FROM stdin;
17	Me and gol7	Me and golu	17	2026-01-11 10:30:16.743608	2026-07-03 18:28:58.703049	f	f	2026-05-21 18:10:15.787373
28	My Expenses	Your personal expense tracker	17	2026-05-04 17:31:59.256497	2026-07-03 18:28:58.725463	f	t	2026-05-21 18:10:15.787373
21	my chennai expense	this is for my personal chennai expense	17	2026-02-13 12:21:45.623022	2026-07-03 18:31:25.777272	f	f	2026-06-18 18:26:11.881546
30	Testing Ultimate	ultra testing chapter	17	2026-05-07 14:53:16.055173	2026-07-03 18:31:25.991192	f	f	2026-07-02 15:27:48.548294
23	Meesho after 6 april	Meesho expense after 6 april	17	2026-04-08 14:42:02.440539	2026-07-02 15:39:30.394303	f	f	2026-05-21 18:10:15.787373
37	My Expenses	Your personal expense tracker	28	2026-06-11 11:00:53.650349	2026-06-14 17:47:03.410679	f	t	2026-06-11 11:00:53.650349
24	Roommate kharcha		23	2026-04-10 09:28:40.809206	2026-06-09 03:57:06.371465	t	f	2026-06-06 04:48:14.093145
36	My Expenses	Your personal expense tracker	27	2026-05-29 07:48:14.595384	2026-05-29 07:50:23.173879	f	t	2026-05-29 07:49:13.230033
19	Goa Trip	Goa Trip for fellow college friends	21	2026-02-02 07:53:05.72752	2026-02-02 07:53:05.72752	f	f	2026-05-21 18:10:15.787373
27	Outings		25	2026-05-02 16:35:23.048337	2026-05-02 16:44:12.843458	t	f	2026-05-21 18:10:15.787373
22	Chennai - 3	Mai , Adarsh aur Om	17	2026-02-23 15:49:53.55452	2026-04-11 07:47:30.166444	t	f	2026-05-21 18:10:15.787373
18	me and archit	mera aur archit ka hisaab	17	2026-01-18 10:21:35.568922	2026-04-11 07:47:48.403911	t	f	2026-05-21 18:10:15.787373
14	testing 3.1	3.1 ki testing	17	2026-01-01 16:29:15.450182	2026-01-01 16:29:15.450182	t	f	2026-05-21 18:10:15.787373
16	testing 3.3		17	2026-01-03 15:13:55.772804	2026-01-03 15:13:55.772804	t	f	2026-05-21 18:10:15.787373
13	Outing of new year	Nothung	17	2026-01-01 15:26:41.677121	2026-01-01 15:26:41.677121	t	f	2026-05-21 18:10:15.787373
10	Testing chapter	For testing purpose	17	2025-12-23 06:40:42.254621	2025-12-23 06:40:42.254621	t	f	2026-05-21 18:10:15.787373
2	goa	goa	17	2025-12-18 18:50:46.440041	2025-12-18 18:50:46.440041	t	f	2026-05-21 18:10:15.787373
9	Vrindavan	29-30 trip	17	2025-12-22 18:43:42.886524	2025-12-22 18:43:42.886524	t	f	2026-05-21 18:10:15.787373
4	Mathura Vrindavan	Hum gaye thye	15	2025-12-20 09:31:26.495241	2026-07-02 15:42:53.523403	f	f	2026-05-26 15:24:49.146479
38	My Expenses	Your personal expense tracker	29	2026-06-11 12:55:27.294635	2026-06-11 12:55:58.999687	f	t	2026-06-11 12:55:27.294635
26	Wonderla		17	2026-04-23 05:50:37.189189	2026-07-02 15:50:01.729724	f	f	2026-05-21 18:10:15.787373
29	My Expenses	Your personal expense tracker	25	2026-05-07 06:52:50.32921	2026-05-07 06:52:57.150489	f	t	2026-05-21 18:10:15.787373
31	hi		18	2026-05-13 07:58:38.941484	2026-05-28 15:41:06.80875	f	f	2026-05-25 18:13:03.115294
32	My Expenses	Your personal expense tracker	26	2026-05-14 06:10:35.582386	\N	f	t	2026-05-21 18:10:15.787373
6	Manali		19	2025-12-21 18:57:53.152979	2026-05-14 06:19:56.047973	f	f	2026-05-21 18:10:15.787373
5	Vrindavan		19	2025-12-21 18:55:11.529416	2026-05-14 06:20:03.875635	f	f	2026-05-21 18:10:15.787373
35	Pondi		17	2026-05-26 13:04:12.18577	2026-07-02 15:51:53.911039	f	f	2026-06-02 16:48:38.9922
3	agra	agra gaya tha mai	15	2025-12-19 16:03:44.174079	2026-07-02 15:14:58.065396	f	f	2026-05-21 18:10:15.787373
11	reunio		17	2025-12-31 11:41:56.794249	2026-07-02 14:33:15.794131	t	f	2026-05-21 18:10:15.787373
20	Meesho	PK and golu meesho personal	17	2026-02-09 15:38:32.577047	2026-07-03 18:19:41.553363	f	f	2026-05-21 18:10:15.787373
\.


--
-- Data for Name: device_sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.device_sessions (id, user_id, session_id, device_name, device_type, browser, os, ip_address, last_active_at, created_at, is_current, jwt_iat) FROM stdin;
1	23	997cee1f2949d9505542af3802830639084438fe441ed91682745b89830ac53a	Chrome on Android	mobile	Chrome	Android	171.79.56.180	2026-05-19 05:25:06.738689	2026-05-19 05:25:06.738689	f	1779168306
2	18	d0a38a5575a67d7a5a454f017cfefa412e81ab0a3746d7378ca0b410f3f25bb6	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-21 18:37:34.669591	2026-05-21 18:37:34.669591	f	1779388654
3	16	386a9282e15a1f7cc09736414c2519a47431bdb854fe4a967b0a4393ba97b918	Chrome on macOS	desktop	Chrome	macOS	152.57.82.110	2026-05-22 17:05:41.676148	2026-05-22 17:05:41.676148	f	1779469541
4	16	552d89b8f700607fc332603fb89b07c62c5b924881e8fd36a1495078e73155ef	Chrome on macOS	desktop	Chrome	macOS	152.57.87.218	2026-05-23 09:09:24.261252	2026-05-23 09:09:24.261252	f	1779527364
5	16	60be3f71f31bf2ced66e9eba7c28304542fd58bc85f3e6c3465ffeb082762e80	Chrome on macOS	desktop	Chrome	macOS	152.57.87.218	2026-05-23 09:09:53.35802	2026-05-23 09:09:53.35802	f	1779527393
6	18	cb3960290b6df19c034877e28ede43f612ddcc02648960356ee3bb0b35d045cd	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-23 18:46:57.625484	2026-05-23 18:46:57.625484	f	1779562017
7	18	888374a0342a0ac6966e3e57f801b20d8cdcac4dc469a727bd92095349c84dc1	Chrome on macOS	desktop	Chrome	macOS	152.57.93.26	2026-05-23 18:49:33.164046	2026-05-23 18:49:33.164046	f	1779562173
8	23	beeb52ac049f7705fcacd1edeced8bfd17f98ea404f3a633270e64b822a75869	Chrome on Android	mobile	Chrome	Android	223.187.114.78	2026-05-23 18:51:34.074611	2026-05-23 18:51:34.074611	f	1779562293
9	15	2ab305336b7ae24996f64aae48bd4a4b62c427d10505b0468bbb543f4dd0b6a6	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-24 08:51:15.457318	2026-05-24 08:51:15.457318	f	1779612674
10	15	22cc1599f21c196c52d50fe43ff14c7f4833b326e9f89fdd9c773c795eae4a26	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-24 09:29:49.956013	2026-05-24 09:29:49.956013	f	1779614989
11	18	c58c302160fdcb01133e816daa1a9b44a6bbb9e72d6e9d495e88a6d49d925c65	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-24 09:34:29.261141	2026-05-24 09:34:29.261141	f	1779615268
12	18	5c95b921d8bf935e38875791182c627ba53743886bfece45259b063621ca6c95	Safari on macOS	desktop	Safari	macOS	::1	2026-05-24 09:48:17.951154	2026-05-24 09:48:17.951154	f	1779616097
13	16	55f9ad02c3aa095a42229dc8dec3470a82e2cc0cbe69ab03eba7174dbdc1943c	Safari on macOS	desktop	Safari	macOS	152.57.91.119	2026-05-24 10:01:59.660289	2026-05-24 10:01:59.660289	f	1779616919
14	16	6be08f728f9af5ebe9c383d4a9830fd5dc629a50cc486716107de1df8f9fbf25	Safari on macOS	desktop	Safari	macOS	152.57.91.119	2026-05-24 10:02:53.099403	2026-05-24 10:02:53.099403	f	1779616972
15	18	8760e44b4988d2858d03b1bcc71c2eb9b9b8ddfc12440bf28f9e4cf2f809a88d	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-24 11:13:02.137605	2026-05-24 11:13:02.137605	f	1779621181
16	23	d2cf2aa4e51e92b58e5c6001c4f1ad3fc910abfb917dbed1abfb1c7256e20012	Chrome on Android	mobile	Chrome	Android	157.51.134.27	2026-05-24 17:48:04.10321	2026-05-24 17:48:04.10321	f	1779644883
17	18	c01e974bb4df5246dee266f423f138a922103be402d8a18492e88666845b943d	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-25 18:12:55.910035	2026-05-25 18:12:55.910035	f	1779732775
18	23	a4af3a5ea87d15408c6635ae6bd2baa4927fd91d73fdc786e50135603362a3ff	Chrome on Android	mobile	Chrome	Android	27.4.142.0	2026-05-25 19:19:23.227252	2026-05-25 19:19:23.227252	f	1779736762
19	15	058bbeef9cc5257af66ee0f8de547459df8afb9ee1a5c9c7d9f9d07e5fdc5e53	Chrome on Android	mobile	Chrome	Android	157.51.126.51	2026-05-26 05:37:46.061166	2026-05-26 05:37:46.061166	f	1779773865
20	15	11adcd4ab02c004a649290e4ceb27962acdb6d3ebb95d7aeefab17e4ce55d38d	Chrome on macOS	desktop	Chrome	macOS	::1	2026-05-26 15:24:10.960729	2026-05-26 15:24:10.960729	f	1779809050
21	27	947bc4cbf25de5e429e1ce5f24bcbfc53746e4fcb28f86489bcffc889685dd3f	Chrome on Android	mobile	Chrome	Android	223.187.123.196	2026-05-29 07:48:13.513634	2026-05-29 07:48:13.513634	f	1780040893
22	23	5acdf29f4583dc62af3942d353d6f9698453df9c6ad1b47257a9a4f567c58163	Chrome on Android	mobile	Chrome	Android	110.224.94.115	2026-05-31 19:18:29.955214	2026-05-31 19:18:29.955214	f	1780255109
23	17	d39f57d7344c9c8f7dbbec9b06077a91b353999bf62b028fe26ff5d48288e32d	Chrome on Android	mobile	Chrome	Android	::1	2026-06-06 15:02:54.096549	2026-06-06 15:02:54.096549	f	1780758173
24	17	c7f1e097676ec4a1c64313c19f227a2d65d7537cdc5f0e34a5dd4e07b137c88a	Chrome on macOS	desktop	Chrome	macOS	27.4.142.0	2026-06-06 15:44:13.248082	2026-06-06 15:44:13.248082	f	1780760652
25	25	5b21cfe1f96ce4eb4c3070fe62bdb7c6b5c8e9b71c751eb9a214c03bb1240987	Chrome on Windows	desktop	Chrome	Windows	49.205.80.213	2026-06-06 16:31:38.277736	2026-06-06 16:31:38.277736	f	1780763498
26	17	5078a6dcf531ccd769475b59ed3a702a22fc07b5c56ab1e46e1a1a27604c4078	Chrome on Android	mobile	Chrome	Android	152.57.82.41	2026-06-06 18:47:37.501819	2026-06-06 18:47:37.501819	f	1780771657
27	28	b3d8bcd89023724d7fdcb24a2c70b934ca8b042d3a21bf082a184e83a93aff2e	Chrome on Android	mobile	Chrome	Android	49.15.119.105	2026-06-11 11:00:52.399071	2026-06-11 11:00:52.399071	f	1781175652
28	29	a9307927bc4db4d45e89b83cd5c23820b274572659f29355657abec3ccceddf6	Chrome on Android	mobile	Chrome	Android	1.38.103.5	2026-06-11 12:55:26.075903	2026-06-11 12:55:26.075903	f	1781182525
29	17	94ca33c5a6154ab702ae3fc3431f6b7dd804879e08b64428671aa10734027de1	Chrome on Android	mobile	Chrome	Android	::1	2026-06-16 15:16:52.128786	2026-06-16 15:16:52.128786	f	1781623011
30	17	49efcae82b3c64c64570e9499d785e026574f85b38ec237225b3759cbcc20efc	Chrome on Android	mobile	Chrome	Android	::1	2026-06-16 15:29:00.294316	2026-06-16 15:29:00.294316	f	1781623740
31	17	0cfa6dc90adb10e9901222047a586ad8cef388ef92b63a30d5e1331a425cb0d7	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-06-17 15:51:51.561516	2026-06-17 15:51:51.561516	f	1781711511
32	17	d19d5681ba47d5396a93945ff5f01385b4105c4deb6c9492e234d0e1678cb58e	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-06-17 16:05:14.201271	2026-06-17 16:05:14.201271	f	1781712313
33	17	e78167c6cf8f718f20e54d2dadd3ab4aa7d7fb88eb89bd1ec839ced034fbc4ae	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-06-18 17:01:44.763067	2026-06-18 17:01:44.763067	f	1781802104
34	17	819ba0904f7a5cba922d093e569afe4d302f4613058b2bbcfe411abcc4fbc792	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:06:10.227113	2026-07-02 14:06:10.227113	f	1783001169
35	17	1272f03743143f1f36253f1f77150f43ae9962d080d2a63ce7ec0cd5f21b4aa9	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-07-02 14:06:50.571658	2026-07-02 14:06:50.571658	f	1783001210
36	17	703b2a9e5059aedc0b857b89693bd4b65ea7aaf05bab3360c96f4549363a30c6	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:10:22.254775	2026-07-02 14:10:22.254775	f	1783001421
37	17	f88d708daaf22b6c95b23a10f06d6c09ba58b54dd229b82a9ee62c38a85f4cef	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:10:59.059644	2026-07-02 14:10:59.059644	f	1783001458
38	17	92e846393149a0d3aa685c6f5506e82f972cd444a53230badfa141e9ae74f76f	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:11:37.68565	2026-07-02 14:11:37.68565	f	1783001497
39	17	b5017bb718b685c747f679dd50275209b934657d1ee3fa0c4e692447e0902fe1	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:22:04.520885	2026-07-02 14:22:04.520885	f	1783002124
40	17	0807ff6adaaf24ba101a5c85076b6e7326b2bd64c6e79af27110fde2cd524085	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:28:04.90398	2026-07-02 14:28:04.90398	f	1783002484
41	17	897ecf28ce82b76b6fe19cccadbedaf322d2cf95872b9ca03fc9d1917c34749e	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:28:42.651669	2026-07-02 14:28:42.651669	f	1783002522
42	17	90b3227ce21f489a290c90d6ea14c590dfdc4c1854c1574a6ce9950437b071fa	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:29:59.539598	2026-07-02 14:29:59.539598	f	1783002599
43	17	f00c46ea1cb9a3db0120b89c5405876656fa48b6779e1bf415a7582a9c70c853	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:31:10.564187	2026-07-02 14:31:10.564187	f	1783002670
44	17	957dc0513e65c6ea2c37adf36947a0e5b56cf9ccff22d31f1b1316f441cab804	Chrome on Android	mobile	Chrome	Android	::ffff:127.0.0.1	2026-07-02 14:31:26.83073	2026-07-02 14:31:26.83073	f	1783002686
45	17	82b58622a73b5bb4940249619e95cc17974667691bccf898bffe07dc7e781848	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-07-02 14:35:50.47365	2026-07-02 14:35:50.47365	f	1783002950
46	17	4fbe295d9f3dba25ef3ad948efdf87cff7f8e2d9af443eb17a81b2f704e2e638	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-07-02 14:36:42.33007	2026-07-02 14:36:42.33007	f	1783003002
47	17	968669c241e897b7997193f97063a674b8109488e65ee44070cbe5516076f708	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-07-02 14:38:41.532073	2026-07-02 14:38:41.532073	f	1783003120
48	15	ec9636aa152c51b7d525a40ef666daaf45b267923ca1370a1fce7084fe3b54f0	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-07-02 14:39:46.009591	2026-07-02 14:39:46.009591	f	1783003185
49	15	871c670de014ff309d31cb522402439b844d4e3c720814bb1343fa2fa3709b59	Chrome on macOS	desktop	Chrome	macOS	::1	2026-07-02 14:41:08.267708	2026-07-02 14:41:08.267708	f	1783003268
50	15	0d9cb8c7f5e0a7827bb0e5dab0de2602062bc568797eabe2b817a77e51e8e511	Chrome on macOS	desktop	Chrome	macOS	::1	2026-07-02 14:47:31.236151	2026-07-02 14:47:31.236151	f	1783003651
51	15	b96ddb76f5f57eb3a3514df11745e3a4b3e4edad0d7aea55c5bd7168ccfa44c9	Chrome on macOS	desktop	Chrome	macOS	::1	2026-07-02 14:48:17.773708	2026-07-02 14:48:17.773708	f	1783003697
52	15	79716e40db0e6432d943468ddd8e4432de3ae3f948047027e621a80c3b97ee83	Chrome on macOS	desktop	Chrome	macOS	::1	2026-07-02 14:50:29.820658	2026-07-02 14:50:29.820658	f	1783003829
53	15	31628444df003cdc15b3cf9dcb06fd525f1bc51556b795fc12c17e96874ab37c	Chrome on macOS	desktop	Chrome	macOS	::1	2026-07-02 14:50:49.728256	2026-07-02 14:50:49.728256	f	1783003849
54	15	053759cd6a6558c4ed8f5a6c56307f250cdd393452a8abc716465ad24158a643	Chrome on macOS	desktop	Chrome	macOS	::1	2026-07-02 14:54:13.815117	2026-07-02 14:54:13.815117	f	1783004053
55	17	ff4a90830ec7e7bbc9c1de7444beebbe4d83ffd58206c7cb3706c23cfbcdae46	Chrome on macOS	desktop	Chrome	macOS	::ffff:127.0.0.1	2026-07-02 14:54:46.347328	2026-07-02 14:54:46.347328	f	1783004086
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, chapter_id, name, status, created_at) FROM stdin;
2	17	Madhur	active	2026-01-11 10:30:46.298494
3	9	Riya last	active	2026-01-11 13:40:25.279871
4	18	tcs interview day	active	2026-01-18 10:21:49.828383
5	17	Meesho	active	2026-02-07 12:21:08.321427
6	24	Pondicherry	active	2026-05-24 17:48:20.151733
7	3	taj mahal visit	active	2026-05-24 17:52:06.581956
8	3	afgra fort visit	active	2026-05-24 17:52:34.739328
9	30	hi	active	2026-05-24 18:18:25.806721
10	24	Outing	active	2026-05-25 19:17:51.162328
11	35	Common	active	2026-06-02 16:38:40.131807
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_categories (id, user_id, name, color, icon, is_system, created_at) FROM stdin;
1	\N	Food	#FF6B6B	🍕	t	2026-05-04 16:55:25.810007
2	\N	Travel	#4ECDC4	✈️	t	2026-05-04 16:55:25.810007
3	\N	Monthly Bill	#45B7D1	🏠	t	2026-05-04 16:55:25.810007
4	\N	Outing	#F9CA24	🎉	t	2026-05-04 16:55:25.810007
5	\N	Health	#A8E6CF	💊	t	2026-05-04 16:55:25.810007
6	\N	Shopping	#FFB347	🛍️	t	2026-05-04 16:55:25.810007
7	\N	Other	#C9C9C9	📦	t	2026-05-04 16:55:25.810007
\.


--
-- Data for Name: expense_splits; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_splits (id, expense_id, member_id, amount_owed) FROM stdin;
1	1	5	170.00
2	1	6	170.00
3	2	5	50.00
4	2	6	50.00
25	7	33	250.00
26	7	34	250.00
27	7	35	250.00
28	7	36	250.00
33	9	33	57.50
34	9	34	57.50
35	9	35	57.50
36	9	36	57.50
37	10	33	20.00
38	10	34	20.00
39	10	35	20.00
40	10	36	20.00
41	11	33	30.00
42	11	34	30.00
43	11	35	30.00
44	11	36	30.00
45	12	33	37.50
46	12	34	37.50
47	12	35	37.50
48	12	36	37.50
49	13	33	260.00
50	13	35	260.00
51	13	36	260.00
52	14	33	137.50
53	14	34	137.50
54	14	35	137.50
55	14	36	137.50
68	18	33	25.00
69	18	34	25.00
70	18	35	25.00
71	18	36	25.00
72	19	33	370.00
73	20	34	470.00
74	21	33	40.00
75	21	34	40.00
76	21	36	40.00
77	22	33	50.00
78	22	34	50.00
79	22	35	50.00
80	22	36	50.00
81	23	33	25.00
82	23	34	25.00
83	23	35	25.00
84	23	36	25.00
85	24	36	100.00
86	25	33	500.00
87	25	34	500.00
88	25	35	500.00
89	25	36	500.00
90	26	33	50.00
91	26	34	50.00
92	26	35	50.00
93	27	33	175.00
94	27	34	175.00
95	27	35	175.00
96	27	36	175.00
97	28	33	20.00
98	28	34	20.00
99	28	35	20.00
100	28	36	20.00
101	29	33	25.00
102	29	34	25.00
103	29	35	25.00
104	29	36	25.00
105	30	33	62.50
106	30	34	62.50
107	30	35	62.50
108	30	36	62.50
109	31	33	25.00
110	31	34	25.00
111	31	35	25.00
112	31	36	25.00
113	32	33	25.00
114	32	34	25.00
115	32	35	25.00
116	32	36	25.00
117	33	33	420.00
118	34	33	100.00
119	34	34	100.00
120	34	35	100.00
121	35	33	50.00
122	36	33	25.00
123	36	34	25.00
124	36	35	25.00
125	36	36	25.00
126	37	37	14.00
127	37	38	14.00
128	37	39	14.00
129	37	40	14.00
133	39	39	69.00
134	40	10	60.00
135	40	11	60.00
136	40	12	60.00
137	40	13	60.00
138	38	39	43.00
139	38	40	43.00
140	16	33	30.00
141	16	34	30.00
142	16	35	30.00
143	17	33	55.34
144	17	34	55.33
145	17	36	55.33
146	6	33	110.00
147	6	34	110.00
148	6	35	110.00
149	6	36	110.00
150	8	33	25.00
151	8	34	25.00
152	41	34	60.00
153	42	35	90.00
154	15	33	500.00
155	15	34	500.00
156	15	35	500.00
157	15	36	500.00
158	43	37	62.00
161	45	37	202.00
162	45	38	202.00
163	45	39	202.00
164	45	40	202.00
165	46	41	26.00
166	46	42	26.00
167	46	43	26.00
168	47	41	14.00
169	47	42	14.00
170	47	43	14.00
171	47	44	14.00
172	48	42	22.34
173	48	43	22.33
174	48	44	22.33
175	49	42	200.00
176	49	43	200.00
177	49	44	200.00
202	57	50	107.50
203	57	51	107.50
204	57	52	107.50
205	57	53	107.50
210	59	54	75.00
211	59	55	75.00
231	66	33	20.00
232	66	34	20.00
233	66	35	20.00
234	66	36	20.00
235	67	33	33.34
236	67	34	33.33
237	67	36	33.33
238	68	62	55.00
239	68	63	55.00
240	69	62	50.00
241	69	63	50.00
242	70	62	60.00
243	70	63	60.00
248	72	61	3500.00
249	73	61	400.00
270	82	61	1700.00
271	83	60	192.00
272	83	61	192.00
273	65	60	61.00
274	65	61	61.00
275	84	67	20170.00
276	85	67	17550.00
277	85	68	17550.00
278	86	67	1700.00
279	86	68	1700.00
280	87	69	80.00
281	88	69	105.00
284	90	69	60.00
285	91	69	14429.00
286	92	69	7063.00
287	93	69	1180.00
288	89	69	1180.00
289	94	69	120.00
290	95	69	65.00
291	96	69	100.00
292	97	69	249.00
293	98	69	20.00
294	99	69	120.00
295	100	69	120.00
296	101	69	420.00
297	102	69	360.00
298	103	69	700.00
299	104	69	40.00
300	105	69	100.00
301	106	67	2160.00
302	106	68	2160.00
303	107	69	160.00
304	108	67	977.50
305	108	68	977.50
306	109	69	315.00
307	110	67	570.00
308	110	68	570.00
309	111	69	350.00
310	112	69	361.00
311	113	69	173.00
312	114	69	190.00
313	115	69	130.00
314	116	69	50.00
315	117	69	309.00
316	118	69	80.00
317	119	67	2232.50
318	119	68	2232.50
319	120	69	40.00
320	121	69	20.00
321	122	67	5020.00
322	123	60	1853.00
323	124	69	150.00
324	125	69	1000.00
325	126	71	116.67
326	126	72	116.67
327	126	73	116.66
328	127	71	90.00
329	127	72	90.00
330	127	73	90.00
331	128	71	100.00
332	128	72	100.00
333	128	73	100.00
334	129	71	16.67
335	129	72	16.67
336	129	73	16.66
337	130	72	100.00
338	130	73	100.00
339	131	71	27.50
340	131	73	27.50
341	132	71	88.00
342	133	72	200.00
343	133	73	200.00
344	134	71	560.00
345	134	72	560.00
346	134	73	560.00
347	135	71	50.00
348	135	72	50.00
349	136	71	70.00
350	136	72	70.00
351	137	71	51.00
352	137	72	51.00
353	138	71	30.00
354	139	71	90.00
355	140	71	38.00
356	140	72	38.00
357	141	71	50.00
358	141	73	50.00
359	142	71	20.00
360	142	72	20.00
361	142	73	20.00
362	143	71	60.00
363	143	72	60.00
364	144	71	20.00
365	144	72	20.00
366	144	73	20.00
367	145	71	50.00
368	145	72	50.00
369	146	71	40.00
370	146	72	40.00
371	146	73	40.00
372	147	71	40.00
373	147	72	40.00
374	147	73	40.00
375	148	71	200.00
376	148	72	200.00
377	149	71	135.00
378	149	72	135.00
379	150	71	180.00
380	150	72	180.00
381	151	71	175.00
382	151	72	175.00
383	152	71	50.00
384	152	72	50.00
385	152	73	50.00
386	153	72	117.00
387	154	69	20.00
388	155	67	475.00
389	155	68	475.00
390	156	69	100.00
391	157	69	60.00
392	158	69	50.00
393	159	67	647.00
394	159	68	647.00
395	160	67	677.50
396	160	68	677.50
397	161	69	1000.00
398	162	69	20.00
399	163	69	1450.00
400	164	72	537.00
401	165	69	550.00
402	166	69	80.00
403	167	69	100.00
404	168	69	1000.00
405	169	69	250.00
406	170	69	80.00
407	171	69	90.00
408	172	67	427.50
409	172	68	427.50
410	173	69	1566.00
411	174	69	70.00
412	175	69	30.00
413	176	69	316.00
414	177	69	20.00
415	178	69	55.00
416	179	69	20.00
417	180	69	300.00
418	181	69	100.00
419	182	69	38.00
420	183	69	20.00
421	184	69	168.00
422	185	69	80.00
423	186	69	110.00
424	187	69	240.00
425	188	69	170.00
426	189	69	50.00
427	190	69	15620.00
428	191	69	460.00
429	192	69	40.00
430	193	69	241.00
431	194	69	100.00
432	195	69	75.00
433	196	69	50.00
434	197	69	170.00
435	198	67	1425.00
436	198	68	1425.00
437	199	67	1662.50
438	199	68	1662.50
439	200	69	60.00
440	201	69	60.00
443	202	69	40.00
444	203	69	120.00
445	204	69	105.00
446	205	69	130.00
447	206	67	2420.00
448	206	68	2420.00
449	207	69	180.00
450	208	69	100.00
451	209	69	130.00
452	210	69	1500.00
453	211	67	2470.00
454	211	68	2470.00
455	212	69	110.00
456	213	69	110.00
457	214	67	2470.00
458	214	68	2470.00
459	215	69	60.00
460	216	69	90.00
461	217	69	180.00
462	218	69	20.00
463	219	67	1750.00
464	219	68	1750.00
465	220	69	40.00
466	221	69	45.00
467	222	69	220.00
468	223	69	50.00
469	224	67	1710.00
470	224	68	1710.00
471	225	69	75.00
472	226	69	170.00
473	227	69	140.00
474	228	69	30.00
475	229	69	50.00
476	230	69	1000.00
477	231	69	20.00
478	232	69	30.00
479	233	69	30.00
480	234	69	40.00
481	235	69	20.00
482	236	69	20.00
483	237	69	188.00
484	238	69	131.00
485	239	69	311.00
486	240	69	20.00
487	241	69	130.00
488	242	69	50.00
489	243	69	20.00
490	244	69	30.00
491	245	69	60.00
494	246	69	20.00
495	247	69	60.00
496	248	69	20.00
497	249	69	20.00
498	250	69	132.00
499	251	69	170.00
500	252	67	1095.00
501	252	68	1095.00
502	253	67	1500.00
503	253	68	1500.00
504	254	69	100.00
505	255	69	180.00
506	256	69	70.00
507	257	69	45.00
508	258	69	100.00
509	259	69	16614.00
510	260	69	85.00
511	261	67	120.00
512	261	68	120.00
513	262	67	190.00
514	262	68	190.00
515	263	69	60.00
517	265	69	100.00
518	266	67	2850.00
519	266	68	2850.00
520	267	67	18000.00
523	269	69	40.00
524	268	69	80.00
525	270	69	168.00
526	271	69	30.00
527	272	74	109.00
528	272	75	109.00
529	273	74	5512.50
530	273	75	5512.50
531	274	69	24.00
532	275	69	20.00
533	276	69	168.00
534	277	69	30.00
535	278	77	1450.00
536	279	76	90.00
537	279	77	90.00
539	280	77	60.00
540	281	69	60.00
541	282	69	35.00
544	283	74	85.00
545	283	75	85.00
546	284	74	125.00
547	284	75	125.00
548	285	69	130.00
549	286	74	4230.00
550	286	75	4230.00
551	287	69	126.00
552	288	76	60.00
553	289	76	128.00
554	289	77	128.00
555	290	76	70.00
556	290	77	70.00
557	291	76	60.00
558	292	69	65.00
559	293	69	140.00
560	294	69	90.00
561	295	69	235.00
562	296	69	20.00
563	297	74	5185.00
564	297	75	5185.00
565	298	76	70.00
566	299	69	100.00
567	300	74	5797.50
568	300	75	5797.50
569	301	74	125.00
570	301	75	125.00
571	302	74	4322.50
572	302	75	4322.50
573	303	74	125.00
574	303	75	125.00
575	304	69	50.00
576	305	69	66.00
577	306	69	30.00
580	308	74	10550.00
581	308	75	10550.00
582	309	74	190.00
583	309	75	190.00
584	310	77	70.00
585	311	69	100.00
586	312	76	50.00
587	312	77	50.00
588	313	69	100.00
589	314	69	80.00
590	315	60	3000.00
591	316	76	30.00
592	317	76	60.00
593	318	69	50.00
594	319	74	367.50
595	319	75	367.50
596	320	74	7812.50
597	320	75	7812.50
598	321	74	7812.50
599	321	75	7812.50
600	322	69	40.00
601	323	69	20.00
602	324	74	461.00
603	324	75	461.00
604	325	76	1319.00
605	326	74	125.00
606	326	75	125.00
607	327	74	20000.00
608	327	75	20000.00
609	328	79	50.00
610	328	80	50.00
611	328	86	50.00
612	329	81	50.00
613	329	82	50.00
614	329	85	50.00
615	330	83	50.00
616	330	87	50.00
617	331	79	155.56
618	331	80	155.56
619	331	81	155.56
620	331	82	155.56
621	331	83	155.56
622	331	84	155.55
623	331	85	155.55
624	331	86	155.55
625	331	87	155.55
635	332	79	87.78
636	332	80	87.78
637	332	81	87.78
638	332	82	87.78
639	332	83	87.78
640	332	84	87.78
641	332	85	87.78
642	332	86	87.77
643	332	87	87.77
644	333	79	16.67
645	333	80	16.67
646	333	81	16.67
647	333	82	16.67
648	333	83	16.67
649	333	84	16.67
650	333	85	16.66
651	333	86	16.66
652	333	87	16.66
653	334	80	70.00
654	334	83	70.00
655	334	84	70.00
656	334	85	70.00
657	334	86	70.00
658	334	87	70.00
659	335	79	41.00
660	335	84	41.00
661	335	86	41.00
662	335	87	41.00
663	336	79	350.00
664	337	69	150.00
665	338	69	1319.00
666	339	79	50.00
667	339	80	50.00
668	340	79	70.00
669	341	84	70.00
671	343	80	250.00
672	343	81	250.00
673	343	82	250.00
674	343	83	250.00
675	343	85	250.00
676	344	69	205.00
677	345	76	87.50
678	345	77	87.50
679	346	76	80.00
680	346	77	80.00
681	347	77	60.00
682	348	74	225.00
683	348	75	225.00
684	349	74	3635.00
685	349	75	3635.00
686	350	76	75.00
687	350	77	75.00
688	351	69	150.00
689	352	69	115.00
690	353	69	35.00
691	354	74	14530.00
692	354	75	14530.00
693	355	79	38.89
694	355	80	38.89
695	355	81	38.89
696	355	82	38.89
697	355	83	38.89
698	355	84	38.89
699	355	85	38.89
700	355	86	38.89
701	355	87	38.88
702	356	69	40.00
703	357	77	100.00
704	358	69	240.00
705	359	69	100.00
706	360	69	500.00
707	361	88	46.67
708	361	89	46.67
709	361	90	46.66
710	362	88	70.00
711	362	89	70.00
712	362	90	70.00
713	363	88	83.34
714	363	89	83.33
715	363	90	83.33
716	364	88	25.00
717	364	89	25.00
718	364	90	25.00
719	365	69	225.00
720	366	69	16960.00
721	367	69	150.00
722	368	69	30.00
723	369	69	14900.00
724	370	69	3000.00
725	371	93	1700.00
726	371	94	1700.00
727	372	93	161.00
728	372	94	161.00
729	373	93	456.00
730	374	69	90.00
731	375	93	101.00
732	375	94	101.00
733	376	60	1138.00
734	376	61	1138.00
735	377	60	130.00
736	377	61	130.00
737	378	60	92.00
738	379	61	80.00
739	380	61	168.00
740	381	61	3000.00
741	382	60	50.00
742	382	61	50.00
743	383	61	811.00
744	384	60	199.50
745	384	61	199.50
748	385	76	1550.00
749	385	77	1550.00
750	386	69	190.00
751	387	69	90.00
752	388	76	95.00
753	389	69	30.00
754	390	69	30.00
755	264	69	50.00
756	391	69	50.00
757	392	76	60.00
758	393	69	200.00
759	394	69	860.00
760	395	76	95.00
761	396	95	45.00
762	397	95	20.00
763	398	76	50.00
764	399	76	14.00
765	399	77	14.00
766	400	69	30.00
767	401	95	54.00
768	402	10	226.00
769	402	11	226.00
770	402	13	226.00
771	403	69	30.00
772	404	114	5.00
773	405	114	3.00
774	406	69	150.00
775	407	69	55.00
776	408	69	165.00
777	409	99	772.38
778	409	100	772.38
779	409	101	772.39
780	409	102	772.38
781	409	103	772.39
782	409	104	772.38
783	409	105	772.38
784	409	106	772.39
785	409	107	772.39
786	409	108	772.38
787	409	109	772.38
788	409	111	772.39
789	409	112	772.39
790	410	99	450.00
791	410	100	450.00
792	410	101	450.00
793	410	102	450.00
794	410	103	450.00
795	410	104	450.00
796	410	105	450.00
797	410	106	450.00
798	410	107	450.00
799	410	108	450.00
800	410	109	450.00
801	410	111	450.00
802	410	112	450.00
803	411	99	23.08
804	411	100	23.08
805	411	101	23.08
806	411	102	23.07
807	411	103	23.08
808	411	104	23.08
809	411	105	23.08
810	411	106	23.07
811	411	107	23.07
812	411	108	23.07
813	411	109	23.08
814	411	111	23.08
815	411	112	23.08
816	412	99	36.16
817	412	100	36.15
818	412	101	36.16
819	412	102	36.16
820	412	103	36.15
821	412	104	36.16
822	412	105	36.15
823	412	106	36.16
824	412	107	36.15
825	412	108	36.15
826	412	109	36.15
827	412	111	36.15
828	412	112	36.15
829	413	99	46.16
830	413	100	46.15
831	413	101	46.15
832	413	102	46.16
833	413	103	46.16
834	413	104	46.15
835	413	105	46.16
836	413	106	46.15
837	413	107	46.15
838	413	108	46.15
839	413	109	46.16
840	413	111	46.15
841	413	112	46.15
842	414	99	115.00
843	414	100	115.00
844	414	101	115.00
845	414	102	115.00
846	414	103	115.00
847	414	104	115.00
848	414	105	115.00
849	414	112	115.00
850	415	99	8.46
851	415	100	8.46
852	415	101	8.47
853	415	102	8.46
854	415	103	8.46
855	415	104	8.46
856	415	105	8.46
857	415	106	8.46
858	415	107	8.47
859	415	108	8.46
860	415	109	8.46
861	415	111	8.46
862	415	112	8.46
863	416	69	167.00
864	417	69	90.00
865	418	76	60.00
866	418	77	60.00
867	419	69	200.00
868	420	69	167.00
869	421	69	360.00
870	422	69	16979.00
871	423	69	90.00
872	424	69	622.00
873	425	69	4000.00
874	426	69	70.00
875	427	69	30.00
876	428	69	129.00
877	429	69	30.00
878	430	69	90.00
879	431	69	30.00
880	432	69	1050.00
881	433	69	250.00
882	434	69	80.00
883	435	69	124.00
884	436	69	30.00
885	437	69	117.00
886	438	69	30.00
887	439	93	22.00
888	439	94	22.00
889	439	113	22.00
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expenses (id, chapter_id, payer_member_id, amount, description, expense_date, created_at, event_id, source_chapter_id, source_member_id, is_synced_from_chapter, sync_consumed_snapshot, sync_dismissed, category_id, updated_at) FROM stdin;
1	2	5	340.00	dinner	2025-12-21 16:21:08.923349	2025-12-21 16:21:08.923349	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
2	2	4	100.00		2025-12-21 16:21:47.498353	2025-12-21 16:21:47.498353	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
6	9	33	440.00	Fastag	2025-12-22 18:44:26.173089	2025-12-22 18:44:26.173089	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
7	9	33	1000.00	Banke Bihari Temple	2025-12-22 18:44:44.163649	2025-12-22 18:44:44.163649	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
8	9	33	50.00	Phool at barsana	2025-12-22 18:45:17.035342	2025-12-22 18:45:17.035342	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
9	9	36	230.00	Maggi	2025-12-22 18:45:36.060286	2025-12-22 18:45:36.060286	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
10	9	36	80.00	Rickshaw	2025-12-22 18:45:55.840663	2025-12-22 18:45:55.840663	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
11	9	36	120.00	cheela	2025-12-22 18:46:09.870628	2025-12-22 18:46:09.870628	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
12	9	36	150.00	Night Chai	2025-12-22 18:46:26.913111	2025-12-22 18:46:26.913111	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
13	9	36	780.00	Peda	2025-12-22 18:46:48.821089	2025-12-22 18:46:48.821089	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
14	9	36	550.00	Lunch isckon	2025-12-22 18:47:09.130321	2025-12-22 18:47:09.130321	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
15	9	34	2000.00	Petrol	2025-12-22 18:47:34.930947	2025-12-22 18:47:34.930947	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
16	9	34	90.00	Momos	2025-12-22 18:47:58.135409	2025-12-22 18:47:58.135409	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
17	9	34	166.00	Burger King	2025-12-22 18:48:18.270199	2025-12-22 18:48:18.270199	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
18	9	34	100.00	Miscellaneous by golu	2025-12-22 18:48:34.102074	2025-12-22 18:48:34.102074	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
19	9	36	370.00	Norwang to Bhatia only	2025-12-22 18:49:32.877078	2025-12-22 18:49:32.877078	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
20	9	36	470.00	Norwang to golu	2025-12-22 18:49:59.698292	2025-12-22 18:49:59.698292	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
21	9	34	120.00	Momos at MKT	2025-12-22 18:50:19.3378	2025-12-22 18:50:19.3378	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
22	9	33	200.00	Photoshot	2025-12-22 18:50:42.048058	2025-12-22 18:50:42.048058	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
23	9	33	100.00	autos on mkt day	2025-12-22 18:51:17.267633	2025-12-22 18:51:17.267633	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
24	9	33	100.00	pavani vaala keychain	2025-12-22 18:51:35.930827	2025-12-22 18:51:35.930827	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
25	9	35	2000.00		2025-12-22 18:51:50.68117	2025-12-22 18:51:50.68117	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
26	9	35	150.00	lunch of 3 	2025-12-22 18:52:11.611486	2025-12-22 18:52:11.611486	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
27	9	35	700.00	dinner at natthu	2025-12-22 18:52:29.53924	2025-12-22 18:52:29.53924	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
28	9	35	80.00	rickshaw by ria	2025-12-22 18:52:47.293891	2025-12-22 18:52:47.293891	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
29	9	35	100.00	mandir ke pandit ji vaale	2025-12-22 18:53:03.571083	2025-12-22 18:53:03.571083	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
30	9	35	250.00	rickshaw again by ria	2025-12-22 18:53:37.123964	2025-12-22 18:53:37.123964	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
31	9	35	100.00	puncture	2025-12-22 18:53:56.918902	2025-12-22 18:53:56.918902	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
32	9	35	100.00	extra by ria	2025-12-22 18:54:18.190226	2025-12-22 18:54:18.190226	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
33	9	35	420.00	keychain,pede and others by ria to bhatia	2025-12-22 18:55:03.423421	2025-12-22 18:55:03.423421	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
34	9	33	300.00	lunch on day 1	2025-12-22 18:55:23.00965	2025-12-22 18:55:23.00965	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
35	9	34	50.00	golu to bhatia	2025-12-22 18:55:45.380208	2025-12-22 18:55:45.380208	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
36	9	33	100.00	miscalleneous by bhatia	2025-12-22 18:56:03.41318	2025-12-22 18:56:03.41318	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
37	10	37	56.00		2025-12-23 06:40:58.338708	2025-12-23 06:40:58.338708	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
38	10	37	86.00		2025-12-23 06:41:18.829537	2025-12-23 06:41:18.829537	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
39	10	38	69.00		2025-12-23 06:41:46.615079	2025-12-23 06:41:46.615079	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
40	4	10	240.00	dinner at taj	2025-12-23 18:51:05.213663	2025-12-23 18:51:05.213663	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
41	9	33	60.00	extra from fastag	2025-12-27 19:22:05.391952	2025-12-27 19:22:05.391952	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
42	9	33	90.00	riya to bhatia , ntcc vaale day ke 	2025-12-27 19:22:50.157625	2025-12-27 19:22:50.157625	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
43	10	37	62.00	Testing only	2025-12-29 16:00:42.604068	2025-12-29 16:00:42.604068	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
45	10	40	808.00		2025-12-31 11:36:43.094655	2025-12-31 11:36:43.094655	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
46	11	42	78.00		2025-12-31 11:42:48.539058	2025-12-31 11:42:48.539058	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
47	11	41	56.00		2025-12-31 11:42:55.229207	2025-12-31 11:42:55.229207	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
48	11	44	67.00		2025-12-31 11:43:05.22888	2025-12-31 11:43:05.22888	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
49	11	43	600.00		2025-12-31 11:43:57.508854	2025-12-31 11:43:57.508854	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
57	13	50	430.00	Pizza vila	2026-01-01 15:27:01.159588	2026-01-01 15:27:01.159588	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
59	14	54	150.00	testing expense	2026-01-01 16:29:29.804626	2026-01-01 16:29:29.804626	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
90	21	69	60.00	ganne ka juice	2026-02-13 12:25:05.00397	2026-02-13 12:25:05.00397	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
66	9	33	80.00	Auto to dlf	2026-01-11 13:40:40.468758	2026-01-11 13:40:40.468758	3	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
67	9	34	100.00		2026-01-11 13:41:34.227263	2026-01-11 13:41:34.227263	3	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
68	18	62	110.00	chaap	2026-01-18 10:23:22.232855	2026-01-18 10:23:22.232855	4	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
69	18	62	100.00	coffe	2026-01-18 10:23:53.669183	2026-01-18 10:23:53.669183	4	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
70	18	62	120.00	kabab	2026-01-18 10:24:16.86508	2026-01-18 10:24:16.86508	4	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
72	17	60	3500.00	jiska hisaab wsap pe 8 jan ko bheja tha 	2026-02-07 12:19:53.243814	2026-02-07 12:19:53.243814	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
73	17	60	400.00	choclates at wh smit not in that 3500 ka hisaab	2026-02-07 12:20:55.013799	2026-02-07 12:20:55.013799	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
91	21	69	14429.00	PG deposit	2026-02-13 12:25:44.388726	2026-02-13 12:25:44.388726	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
92	21	69	7063.00	PG rent till feb end	2026-02-13 12:26:09.086966	2026-02-13 12:26:09.086966	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
82	17	60	1700.00	gym	2026-02-09 15:27:03.2563	2026-02-09 15:27:03.2563	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
83	17	60	384.00	cafe delhi heights	2026-02-09 15:28:19.487444	2026-02-09 15:28:19.487444	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
65	17	60	122.00	Auto at madhur virli	2026-01-11 10:30:59.931449	2026-01-11 10:30:59.931449	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
84	20	68	20170.00	teri contri till 9 feb	2026-02-09 15:39:02.251748	2026-02-09 15:39:02.251748	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
85	20	67	35100.00	total till 9 feb	2026-02-09 15:39:37.716598	2026-02-09 15:39:37.716598	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
86	20	67	3400.00	11 feb to nikhil	2026-02-11 13:03:29.541325	2026-02-11 13:03:29.541325	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
87	21	69	80.00	yaad nahi	2026-02-13 12:23:15.627834	2026-02-13 12:23:15.627834	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
88	21	69	105.00	uttapam dinner at 12 feb	2026-02-13 12:23:59.910111	2026-02-13 12:23:59.910111	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
93	21	69	1180.00	token	2026-02-13 12:27:13.583995	2026-02-13 12:27:13.583995	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
89	21	69	1180.00	failed booking	2026-02-13 12:24:28.384561	2026-02-13 12:24:28.384561	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
94	21	69	120.00	Dinner 13feb	2026-02-13 15:57:15.036593	2026-02-13 15:57:15.036593	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
95	21	69	65.00	Supermarket on 13	2026-02-14 06:45:31.909648	2026-02-14 06:45:31.909648	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
96	21	69	100.00	Nashta sandwich on 14 feb	2026-02-14 06:46:22.885428	2026-02-14 06:46:22.885428	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
97	21	69	249.00	Bedsheets	2026-02-14 13:27:36.932123	2026-02-14 13:27:36.932123	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
98	21	69	20.00	Sambhar vada breakfast on 15	2026-02-15 18:13:15.086107	2026-02-15 18:13:15.086107	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
99	21	69	120.00	Nariyal Pani outside mandir	2026-02-15 18:13:53.16231	2026-02-15 18:13:53.16231	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
100	21	69	120.00	Mithai	2026-02-15 18:14:18.126239	2026-02-15 18:14:18.126239	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
101	21	69	420.00	Supermarket	2026-02-15 18:14:30.613536	2026-02-15 18:14:30.613536	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
102	21	69	360.00	Zepto on 15	2026-02-15 18:14:55.09503	2026-02-15 18:14:55.09503	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
103	21	69	700.00	Dinner to adarsh ok 16	2026-02-16 12:52:27.248494	2026-02-16 12:52:27.248494	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
104	21	69	40.00	Sambhar vada breakfast on joining date	2026-02-16 12:53:05.330201	2026-02-16 12:53:05.330201	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
105	21	69	100.00	Bartan	2026-02-16 16:47:53.989407	2026-02-16 16:47:53.989407	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
106	20	67	4320.00	16 feb nikhil	2026-02-16 18:44:24.879978	2026-02-16 18:44:24.879978	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
107	21	69	160.00	Scrub	2026-02-17 17:54:31.989805	2026-02-17 17:54:31.989805	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
108	20	67	1955.00	Payment of 17 feb ,done on 18feb	2026-02-18 10:28:27.55227	2026-02-18 10:28:27.55227	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
109	21	69	315.00	Match ticket 	2026-02-19 04:10:56.318777	2026-02-19 04:10:56.318777	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
110	20	67	1140.00	19 feb	2026-02-19 13:43:39.123262	2026-02-19 13:43:39.123262	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
111	21	69	350.00	Jeresey	2026-02-19 18:52:43.413774	2026-02-19 18:52:43.413774	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
112	21	69	361.00	Food on match day	2026-02-19 18:53:15.388918	2026-02-19 18:53:15.388918	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
113	21	69	173.00	To rishvanth for commute	2026-02-20 03:36:13.909186	2026-02-20 03:36:13.909186	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
114	21	69	190.00	Snacks on friday	2026-02-20 15:13:50.170822	2026-02-20 15:13:50.170822	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
115	21	69	130.00	Courier	2026-02-21 20:33:12.328244	2026-02-21 20:33:12.328244	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
116	21	69	50.00	Nashta on sat 21 feb	2026-02-21 20:33:51.28524	2026-02-21 20:33:51.28524	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
117	21	69	309.00	Commute of wattic	2026-02-21 20:34:41.291875	2026-02-21 20:34:41.291875	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
118	21	69	80.00	Daadhi on sat	2026-02-21 20:36:14.273415	2026-02-21 20:36:14.273415	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
119	20	67	4465.00	payment of 21 feb on 22 feb	2026-02-22 10:09:39.909919	2026-02-22 10:09:39.909919	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
120	21	69	40.00	Combo kitchen lunch on22 feb	2026-02-22 15:10:03.99528	2026-02-22 15:10:03.99528	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
121	21	69	20.00	Patties on 22 feb	2026-02-22 15:10:14.738271	2026-02-22 15:10:14.738271	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
122	20	68	5020.00	Golu to me for settlement on23 feb	2026-02-23 03:49:51.762296	2026-02-23 03:49:51.762296	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
123	17	61	1853.00	Golu to me on 23 feb	2026-02-23 03:50:42.446023	2026-02-23 03:50:42.446023	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
124	21	69	150.00	Samosa + rasmalai	2026-02-23 03:51:57.970237	2026-02-23 03:51:57.970237	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
125	21	69	1000.00	GYM cash	2026-02-23 09:18:50.027752	2026-02-23 09:18:50.027752	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
126	22	73	350.00	beach ka commute (160+190)	2026-02-23 15:51:29.405906	2026-02-23 15:51:29.405906	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
127	22	73	270.00	bhawani misthan uttapam	2026-02-23 15:51:54.702203	2026-02-23 15:51:54.702203	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
128	22	73	300.00	hotel by om 	2026-02-23 15:52:14.224952	2026-02-23 15:52:14.224952	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
129	22	73	50.00	auto from hotel to om's pg (Bargained)	2026-02-23 15:53:13.460713	2026-02-23 15:53:13.460713	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
130	22	73	200.00	chicken fried rice on first day	2026-02-23 15:53:35.764404	2026-02-23 15:53:35.764404	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
131	22	73	55.00	kela on day one	2026-02-23 15:53:51.000833	2026-02-23 15:53:51.000833	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
132	22	73	88.00	pziza on kathibera	2026-02-23 15:54:20.168333	2026-02-23 15:54:20.168333	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
133	22	72	400.00	cab from airport	2026-02-23 16:10:00.74484	2026-02-23 16:10:00.74484	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
134	22	72	1680.00	hotel	2026-02-23 16:10:32.59367	2026-02-23 16:10:32.59367	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
135	22	72	100.00	auto from hotel to pg 	2026-02-23 16:11:10.361726	2026-02-23 16:11:10.361726	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
136	22	72	140.00	dosa delight	2026-02-23 16:12:14.161117	2026-02-23 16:12:14.161117	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
137	22	72	102.00	groceries (washing)	2026-02-23 16:17:02.564582	2026-02-23 16:17:02.564582	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
138	22	72	30.00	copy	2026-02-23 16:19:28.347571	2026-02-23 16:19:28.347571	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
139	22	72	90.00	23 feb ka food	2026-02-23 16:20:38.857121	2026-02-23 16:20:38.857121	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
140	22	72	76.00	auto from jeeva park	2026-02-23 16:21:00.307276	2026-02-23 16:21:00.307276	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
141	22	71	100.00	food of 12 feb (uttapam)	2026-02-23 16:22:05.076438	2026-02-23 16:22:05.076438	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
142	22	71	60.00	ganne k juice	2026-02-23 16:22:22.402905	2026-02-23 16:22:22.402905	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
143	22	71	120.00	dinner 13 feb	2026-02-23 16:22:52.359125	2026-02-23 16:22:52.359125	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
144	22	71	60.00	supermarket on 13 feb	2026-02-23 16:23:50.318837	2026-02-23 16:23:50.318837	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
145	22	71	100.00	metr cafe sndwich	2026-02-23 16:24:10.107708	2026-02-23 16:24:10.107708	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
146	22	71	120.00	nariyal 	2026-02-23 16:24:29.695179	2026-02-23 16:24:29.695179	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
147	22	71	120.00	mithai	2026-02-23 16:24:53.394804	2026-02-23 16:24:53.394804	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
148	22	72	400.00	bedsheets	2026-02-23 16:26:16.167942	2026-02-23 16:26:16.167942	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
149	22	71	270.00	supermarket (chota mota)	2026-02-23 16:27:02.904963	2026-02-23 16:27:02.904963	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
150	22	71	360.00	zepto	2026-02-23 16:27:40.971284	2026-02-23 16:27:40.971284	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
151	22	71	350.00	jersey	2026-02-23 16:28:18.321478	2026-02-23 16:28:18.321478	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
152	22	71	150.00	snacks ...	2026-02-23 16:29:02.589672	2026-02-23 16:29:02.589672	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
153	22	73	117.00	om to adarsh	2026-02-23 16:33:10.069025	2026-02-23 16:33:10.069025	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
154	21	69	20.00	Badam milk	2026-02-24 18:13:06.561212	2026-02-24 18:13:06.561212	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
155	20	67	950.00	Payment on 24 feb	2026-02-24 18:13:41.942434	2026-02-24 18:13:41.942434	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
156	21	69	100.00	To sahayak for dinner of 24 feb	2026-02-25 17:57:42.772402	2026-02-25 17:57:42.772402	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
157	21	69	60.00	dabbe 	2026-02-25 17:57:52.191249	2026-02-25 17:57:52.191249	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
158	21	69	50.00	ice cream on 25 me and vansh	2026-02-25 17:58:12.97845	2026-02-25 17:58:12.97845	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
159	20	67	1294.00	To lakshay bhatia for porter on 26 feb	2026-02-26 17:20:58.743282	2026-02-26 17:20:58.743282	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
160	20	67	1355.00	To nikhil ok 26 feb	2026-02-26 17:21:08.385756	2026-02-26 17:21:08.385756	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
161	21	69	1000.00	to vansh for kanan sir outing	2026-02-27 15:08:58.993214	2026-02-27 15:08:58.993214	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
162	21	69	20.00	milk on 27 feb	2026-02-27 15:09:31.658094	2026-02-27 15:09:31.658094	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
163	21	69	1450.00	for dinner till 11th march	2026-02-27 15:09:46.525714	2026-02-27 15:09:46.525714	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
164	22	71	537.00		2026-02-27 15:13:51.470763	2026-02-27 15:13:51.470763	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
165	21	69	550.00	to adarsh against setllements	2026-02-27 15:24:08.840852	2026-02-27 15:24:08.840852	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
166	21	69	80.00	To adarsh for cold drink and soveniour	2026-02-28 17:45:56.675999	2026-02-28 17:45:56.675999	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
167	21	69	100.00	Durbeen	2026-02-28 17:46:06.102442	2026-02-28 17:46:06.102442	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
168	21	69	1000.00	To vansh again for trip	2026-02-28 17:46:21.163741	2026-02-28 17:46:21.163741	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
169	21	69	250.00	For lunch on trip day 28 feb	2026-02-28 17:46:40.368924	2026-02-28 17:46:40.368924	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
170	21	69	80.00	Shoe travel	2026-03-03 03:34:22.188437	2026-03-03 03:34:22.188437	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
171	21	69	90.00	Dosa delight on 1 march	2026-03-03 03:35:10.308206	2026-03-03 03:35:10.308206	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
172	20	67	855.00	Payment of 2 march on 3 march	2026-03-03 17:35:50.249922	2026-03-03 17:35:50.249922	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
173	21	69	1566.00	for mithais	2026-03-08 07:56:30.09081	2026-03-08 07:56:30.09081	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
174	21	69	70.00	lunch on 1 march	2026-03-08 07:57:23.237955	2026-03-08 07:57:23.237955	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
175	21	69	30.00	samose on 1 march	2026-03-08 07:57:38.506022	2026-03-08 07:57:38.506022	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
176	21	69	316.00	mithai on 1 march	2026-03-08 07:57:50.526872	2026-03-08 07:57:50.526872	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
177	21	69	20.00	something small from railwaymarket	2026-03-08 07:58:11.086888	2026-03-08 07:58:11.086888	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
178	21	69	55.00	towel for gym	2026-03-08 07:58:48.474093	2026-03-08 07:58:48.474093	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
179	21	69	20.00	bm on 2 march	2026-03-08 07:59:48.395786	2026-03-08 07:59:48.395786	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
180	21	69	300.00	zeptos riya + archit	2026-03-08 08:00:10.820016	2026-03-08 08:00:10.820016	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
181	21	69	100.00	tip to bach	2026-03-08 08:00:23.518737	2026-03-08 08:00:23.518737	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
182	21	69	38.00	earbuds cover	2026-03-08 08:00:39.234418	2026-03-08 08:00:39.234418	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
183	21	69	20.00	bm on3 march	2026-03-08 08:00:56.237049	2026-03-08 08:00:56.237049	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
184	21	69	168.00	 rumali roti	2026-03-08 08:02:31.483796	2026-03-08 08:02:31.483796	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
185	21	69	80.00	breakfast on 5 march	2026-03-08 08:02:49.237733	2026-03-08 08:02:49.237733	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
186	21	69	110.00	ice creams on 5 march	2026-03-08 08:03:42.004186	2026-03-08 08:03:42.004186	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
187	21	69	240.00	ali+ballu+golu	2026-03-08 08:03:59.357562	2026-03-08 08:03:59.357562	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
188	21	69	170.00	ice creams on night	2026-03-08 08:06:17.918307	2026-03-08 08:06:17.918307	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
189	21	69	50.00	bf on 7 march dosa delights	2026-03-08 08:06:38.305203	2026-03-08 08:06:38.305203	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
190	21	69	15620.00	rent of march	2026-03-08 08:06:52.687629	2026-03-08 08:06:52.687629	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
191	21	69	460.00	marina beach cab + spring potato	2026-03-08 08:07:12.103379	2026-03-08 08:07:12.103379	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
192	21	69	40.00	fruit beer on marina	2026-03-08 08:07:27.941667	2026-03-08 08:07:27.941667	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
193	21	69	241.00	zepto (shampoo+ sarf) on 7 march	2026-03-08 08:07:52.342833	2026-03-08 08:07:52.342833	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
194	21	69	100.00	bf on 8 march	2026-03-08 08:08:03.475713	2026-03-08 08:08:03.475713	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
195	21	69	75.00	Sandwich on 8 march	2026-03-08 13:40:08.707906	2026-03-08 13:40:08.707906	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
196	21	69	50.00	Idli + badam milk on 9 march	2026-03-09 13:58:26.464097	2026-03-09 13:58:26.464097	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
197	21	69	170.00	Hair cut	2026-03-09 17:50:32.069179	2026-03-09 17:50:32.069179	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
198	20	67	2850.00	Payment of 9 march 	2026-03-10 03:11:25.907023	2026-03-10 03:11:25.907023	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
199	20	67	3325.00	payment of 13 march on 14 march	2026-03-14 07:55:34.962433	2026-03-14 07:55:34.962433	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
200	21	69	60.00	sarvana bhawan expense	2026-03-14 08:00:15.508918	2026-03-14 08:00:15.508918	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
201	21	69	60.00	badam milk expense	2026-03-14 08:00:46.542851	2026-03-14 08:00:46.542851	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
202	21	69	40.00	dd on 12 breakfast	2026-03-14 08:01:11.590571	2026-03-14 08:01:11.590571	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
203	21	69	120.00	Dosa on 14 march 	2026-03-14 16:15:44.292561	2026-03-14 16:15:44.292561	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
204	21	69	105.00	Commute on 14 march	2026-03-14 19:45:45.342986	2026-03-14 19:45:45.342986	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
205	21	69	130.00	pizza party on friday	2026-03-15 12:36:47.119149	2026-03-15 12:36:47.119149	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
206	20	67	4840.00	Payment of 16 march on 17	2026-03-17 06:22:30.119112	2026-03-17 06:22:30.119112	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
207	21	69	180.00	Mithai + press + golgappe	2026-03-17 15:11:34.302921	2026-03-17 15:11:34.302921	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
208	21	69	100.00	Nashta on 16 and 17	2026-03-17 15:12:19.068904	2026-03-17 15:12:19.068904	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
209	21	69	130.00	Kapri + kapda 	2026-03-17 15:12:41.939358	2026-03-17 15:12:41.939358	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
210	21	69	1500.00	To adarsh for dinner	2026-03-17 15:12:51.379891	2026-03-17 15:12:51.379891	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
211	20	67	4940.00	payment of 17 march	2026-03-17 17:33:27.907357	2026-03-17 17:33:27.907357	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
212	21	69	110.00	Lunch on 18 March holiday	2026-03-18 15:53:20.218108	2026-03-18 15:53:20.218108	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
213	21	69	110.00	Momos + fruit beer	2026-03-18 15:53:38.104985	2026-03-18 15:53:38.104985	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
214	20	67	4940.00	payment of 20 march on 21 march	2026-03-21 08:33:09.004529	2026-03-21 08:33:09.004529	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
215	21	69	60.00	dd on 19 march	2026-03-21 08:38:07.669945	2026-03-21 08:38:07.669945	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
216	21	69	90.00	travel on movie day	2026-03-21 08:38:30.518708	2026-03-21 08:38:30.518708	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
217	21	69	180.00	dinner (uttapmam) on movie day	2026-03-21 08:38:56.818479	2026-03-21 08:38:56.818479	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
218	21	69	20.00	BM	2026-03-21 08:39:02.963154	2026-03-21 08:39:02.963154	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
219	20	68	3500.00	to lakshay bhatia	2026-03-22 09:27:53.691559	2026-03-22 09:27:53.691559	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
220	21	69	40.00	combo kitchen on 21 march	2026-03-22 17:31:28.895652	2026-03-22 17:31:28.895652	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
221	21	69	45.00	snacks on 21 march	2026-03-22 17:32:53.046185	2026-03-22 17:32:53.046185	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
222	21	69	220.00	mablam food + capri on 22 march	2026-03-22 17:33:17.259991	2026-03-22 17:33:17.259991	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
223	21	69	50.00	temper gaurd	2026-03-22 17:34:09.88934	2026-03-22 17:34:09.88934	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
224	20	67	3420.00	Payment of 27 march on 28 march	2026-03-28 19:03:58.580726	2026-03-28 19:03:58.580726	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
225	21	69	75.00	DDD on 23 march	2026-03-29 08:18:38.298368	2026-03-29 08:18:38.298368	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
226	21	69	170.00	Kal dosas on 23 dd	2026-03-29 08:19:04.016186	2026-03-29 08:19:04.016186	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
227	21	69	140.00	Not reme	2026-03-29 08:19:46.610545	2026-03-29 08:19:46.610545	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
228	21	69	30.00	Dd breakfast on 24 march	2026-03-29 08:20:05.42813	2026-03-29 08:20:05.42813	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
229	21	69	50.00	Ice cream on olympia	2026-03-29 08:20:33.910318	2026-03-29 08:20:33.910318	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
230	21	69	1000.00	Gym 	2026-03-29 08:20:49.114724	2026-03-29 08:20:49.114724	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
231	21	69	20.00	Bm on 24	2026-03-29 08:22:30.625053	2026-03-29 08:22:30.625053	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
232	21	69	30.00	CK on 25 bf	2026-03-29 08:25:26.908141	2026-03-29 08:25:26.908141	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
233	21	69	30.00	To vansh for ic	2026-03-29 08:25:32.790701	2026-03-29 08:25:32.790701	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
234	21	69	40.00	Ck idli	2026-03-29 08:25:44.806831	2026-03-29 08:25:44.806831	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
235	21	69	20.00	Ck bf on 27	2026-03-29 08:26:03.069465	2026-03-29 08:26:03.069465	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
236	21	69	20.00	Bm 	2026-03-29 08:26:22.562907	2026-03-29 08:26:22.562907	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
237	21	69	188.00	Zepto on 28	2026-03-29 08:26:46.580423	2026-03-29 08:26:46.580423	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
238	21	69	131.00	Burger king on 28 night	2026-03-29 08:26:57.942309	2026-03-29 08:26:57.942309	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
239	21	69	311.00	Chole bhature on 29 	2026-03-29 08:27:27.224936	2026-03-29 08:27:27.224936	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
240	21	69	20.00	Toffes on 28 	2026-03-29 08:27:40.160566	2026-03-29 08:27:40.160566	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
241	21	69	130.00	Mari hotel	2026-03-29 14:49:04.983543	2026-03-29 14:49:04.983543	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
242	21	69	50.00	Grapes	2026-03-29 14:49:17.700924	2026-03-29 14:49:17.700924	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
243	21	69	20.00	Chocos	2026-03-29 14:49:31.526578	2026-03-29 14:49:31.526578	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
244	21	69	30.00	Breakfast on 30march	2026-03-30 03:13:59.583511	2026-03-30 03:13:59.583511	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
245	21	69	60.00	Dinner on 30 march	2026-03-30 15:18:51.825776	2026-03-30 15:18:51.825776	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
246	21	69	20.00	Bm	2026-04-01 03:24:04.302176	2026-04-01 03:24:04.302176	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
247	21	69	60.00	Bf on 1 april	2026-04-01 03:24:28.100374	2026-04-01 03:24:28.100374	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
248	21	69	20.00	Cd	2026-04-01 03:24:43.770754	2026-04-01 03:24:43.770754	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
249	21	69	20.00	Bm on 1 april	2026-04-02 05:56:45.009579	2026-04-02 05:56:45.009579	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
250	21	69	132.00	Ice creams sponsorship on 1 april 	2026-04-02 05:57:02.392505	2026-04-02 05:57:02.392505	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
251	21	69	170.00	Turf on 1 april	2026-04-02 05:57:12.681091	2026-04-02 05:57:12.681091	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
252	20	67	2190.00	Payment of 1 April on 2 April	2026-04-02 15:09:26.475509	2026-04-02 15:09:26.475509	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
253	20	67	3000.00	Nikhil ki Fees	2026-04-02 15:09:47.019128	2026-04-02 15:09:47.019128	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
254	21	69	100.00	Food expense 	2026-04-03 15:04:08.177932	2026-04-03 15:04:08.177932	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
255	21	69	180.00	Hair cut	2026-04-05 08:32:42.893873	2026-04-05 08:32:42.893873	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
256	21	69	70.00	Food of 4 april	2026-04-05 08:33:07.371351	2026-04-05 08:33:07.371351	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
257	21	69	45.00	Juice	2026-04-05 08:33:43.892392	2026-04-05 08:33:43.892392	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
258	21	69	100.00	Parrys chaap + athua	2026-04-05 08:33:54.28346	2026-04-05 08:33:54.28346	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
259	21	69	16614.00	Rent of April	2026-04-05 08:35:21.879112	2026-04-05 08:35:21.879112	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
260	21	69	85.00	Juice + sabdwucg	2026-04-05 17:33:46.983171	2026-04-05 17:33:46.983171	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
261	20	67	240.00	Porter on 4 april 	2026-04-06 06:15:06.60633	2026-04-06 06:15:06.60633	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
262	20	68	380.00	Golu porter 	2026-04-06 06:42:38.353766	2026-04-06 06:42:38.353766	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
263	21	69	60.00	ice cream 6 april	2026-04-06 14:03:41.900661	2026-04-06 14:03:41.900661	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
265	21	69	100.00	khajoor	2026-04-06 14:11:49.92913	2026-04-06 14:11:49.92913	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
266	20	67	5700.00	Payment of 5 april on 6 april	2026-04-06 14:42:48.916116	2026-04-06 14:42:48.916116	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
267	20	68	18000.00	36k withdrawl for settlements 	2026-04-06 14:46:02.21365	2026-04-06 14:46:02.21365	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
269	21	69	40.00	Lassi in parrys	2026-04-06 17:09:54.26857	2026-04-06 17:09:54.26857	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
268	21	69	80.00	Dinner on 6 ap	2026-04-06 17:09:44.223456	2026-04-06 17:09:44.223456	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
270	21	69	168.00	chocolates to suhani	2026-04-07 16:06:50.667974	2026-04-07 16:06:50.667974	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
271	21	69	30.00	Nashta on 8 april	2026-04-08 05:22:31.897662	2026-04-08 05:22:31.897662	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
272	23	74	218.00	porter of 7 april	2026-04-08 14:42:25.376031	2026-04-08 14:42:25.376031	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
273	23	74	11025.00	payment of 7 and 8 april	2026-04-08 14:42:37.038984	2026-04-08 14:42:37.038984	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
274	21	69	24.00	Samose on 8 april	2026-04-09 03:12:31.638419	2026-04-09 03:12:31.638419	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
275	21	69	20.00	Nashta on 9 april	2026-04-09 03:13:01.602134	2026-04-09 03:13:01.602134	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
276	21	69	168.00	Ria choclates	2026-04-09 03:13:29.463801	2026-04-09 03:13:29.463801	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
277	21	69	30.00	Nashta on 10 april	2026-04-10 09:16:49.470232	2026-04-10 09:16:49.470232	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
278	24	76	1450.00	Dinner Seema Singh	2026-04-10 09:30:42.77917	2026-04-10 09:30:42.77917	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
279	24	77	180.00	Country Delight	2026-04-10 09:31:36.717354	2026-04-10 09:31:36.717354	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
280	24	76	60.00	Burger king Veg makhani	2026-04-10 09:33:42.998137	2026-04-10 09:33:42.998137	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
281	21	69	60.00	Pomegranate Juice	2026-04-10 17:12:42.606522	2026-04-10 17:12:42.606522	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
282	21	69	35.00	Snacks on 10 april	2026-04-10 17:13:03.773603	2026-04-10 17:13:03.773603	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
283	23	74	170.00	Porter of 8 april	2026-04-10 17:14:14.316263	2026-04-10 17:14:14.316263	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
284	23	74	250.00	Porter of 10 april	2026-04-10 17:14:34.114721	2026-04-10 17:14:34.114721	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
285	21	69	130.00	lunch on 11 april	2026-04-11 07:30:05.238256	2026-04-11 07:30:05.238256	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
286	23	74	8460.00	Payment of 10 april on 11 april	2026-04-11 07:33:38.579335	2026-04-11 07:33:38.579335	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
287	21	69	126.00	travel of 11 april , mall day	2026-04-12 09:02:42.534267	2026-04-12 09:02:42.534267	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
288	24	77	60.00	Sat lunch	2026-04-12 09:09:05.188008	2026-04-12 09:09:05.188008	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
289	24	76	256.00	Maggi coke sat night	2026-04-12 09:10:03.269842	2026-04-12 09:10:03.269842	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
290	24	77	140.00	Mithai sunday shaam	2026-04-12 15:17:24.440501	2026-04-12 15:17:24.440501	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
291	24	77	60.00	Dosa mariHotel	2026-04-12 15:18:20.547142	2026-04-12 15:18:20.547142	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
292	21	69	65.00	Samosa + chaat on 12 april	2026-04-13 15:29:07.480937	2026-04-13 15:29:07.480937	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
293	21	69	140.00	Mithai on 12 april	2026-04-13 15:29:21.825363	2026-04-13 15:29:21.825363	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
294	21	69	90.00	Mari hotel on 12 april	2026-04-13 15:29:34.574191	2026-04-13 15:29:34.574191	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
295	21	69	235.00	Dinner on 13 april 	2026-04-13 15:29:59.28646	2026-04-13 15:29:59.28646	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
296	21	69	20.00	Nashta on 13 april	2026-04-13 15:30:14.074345	2026-04-13 15:30:14.074345	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
297	23	74	10370.00	Payment of 12 April on 13 April	2026-04-13 16:40:57.324528	2026-04-13 16:40:57.324528	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
298	24	77	70.00	Dosa delight dinner	2026-04-14 07:33:49.391065	2026-04-14 07:33:49.391065	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
299	21	69	100.00	Brunch on 14 april 	2026-04-14 08:31:05.774255	2026-04-14 08:31:05.774255	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
300	23	74	11595.00	Payment of 14 April	2026-04-14 17:31:37.676027	2026-04-14 17:31:37.676027	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
301	23	74	250.00	Porter of 14 April	2026-04-14 17:31:50.817285	2026-04-14 17:31:50.817285	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
302	23	74	8645.00	Payment of 15 april	2026-04-15 15:31:21.168459	2026-04-15 15:31:21.168459	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
303	23	74	250.00	Porter of 15 april	2026-04-15 15:31:27.100662	2026-04-15 15:31:27.100662	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
304	21	69	50.00	Nashta on 15 and 16	2026-04-16 03:26:49.394273	2026-04-16 03:26:49.394273	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
305	21	69	66.00	Movie ticket 	2026-04-17 07:40:58.904937	2026-04-17 07:40:58.904937	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
306	21	69	30.00	Bf on 17 april	2026-04-17 07:41:46.379841	2026-04-17 07:41:46.379841	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
308	23	75	21100.00	Payment of 18 April	2026-04-17 19:20:35.302777	2026-04-17 19:20:35.302777	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
309	23	74	380.00	Porter of 18 april	2026-04-17 19:20:50.472477	2026-04-17 19:20:50.472477	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
310	24	76	70.00	Combo kitchen sat lunch	2026-04-18 07:56:28.862884	2026-04-18 07:56:28.862884	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
311	21	69	100.00	Movie travel + cd + snacks	2026-04-18 08:23:05.548765	2026-04-18 08:23:05.548765	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
312	24	77	100.00	Dosa delight dinner sat	2026-04-18 14:21:31.714888	2026-04-18 14:21:31.714888	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
313	21	69	100.00	Kal dosa on saturday	2026-04-20 04:52:50.003098	2026-04-20 04:52:50.003098	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
314	21	69	80.00	Golgappe + dahi	2026-04-20 04:53:45.644203	2026-04-20 04:53:45.644203	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
315	17	61	3000.00	Payment on 20 april	2026-04-20 09:24:30.588703	2026-04-20 09:24:30.588703	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
316	24	77	30.00	Golgappa and dahi	2026-04-20 17:27:32.877484	2026-04-20 17:27:32.877484	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
317	24	77	60.00	Dosa delight mon dinner	2026-04-20 17:27:50.282266	2026-04-20 17:27:50.282266	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
318	21	69	50.00	Kal dosa	2026-04-20 17:58:46.471728	2026-04-20 17:58:46.471728	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
319	23	74	735.00	porter of 19 april	2026-04-20 17:59:21.13482	2026-04-20 17:59:21.13482	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
320	23	75	15625.00	Payment of 19 april by golu	2026-04-20 18:00:07.06874	2026-04-20 18:00:07.06874	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
321	23	74	15625.00	Payment of 19 april by Parth	2026-04-20 18:00:22.015361	2026-04-20 18:00:22.015361	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
322	21	69	40.00	Silai of pajama	2026-04-21 17:46:19.903978	2026-04-21 17:46:19.903978	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
323	21	69	20.00	Nashta on 21 april	2026-04-21 17:46:31.813893	2026-04-21 17:46:31.813893	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
324	23	74	922.00	Porter of 21 april 	2026-04-21 17:47:04.236676	2026-04-21 17:47:04.236676	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
325	24	77	1319.00	Wonderla Amusement park	2026-04-22 08:21:34.921988	2026-04-22 08:21:34.921988	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
326	23	74	250.00	Porter on 22 april	2026-04-22 18:12:10.407796	2026-04-22 18:12:10.407796	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
327	23	74	40000.00	Partial payment of 40000 on 22 april 	2026-04-22 18:12:36.173302	2026-04-22 18:12:36.173302	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
328	26	79	150.00	Dosa delight dosa	2026-04-23 05:51:36.358181	2026-04-23 05:51:36.358181	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
329	26	82	150.00	Dosa Delight dosa	2026-04-23 05:52:13.152945	2026-04-23 05:52:13.152945	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
330	26	83	100.00		2026-04-23 05:52:52.372089	2026-04-23 05:52:52.372089	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
331	26	79	1400.00	Cab	2026-04-23 06:34:11.246023	2026-04-23 06:34:11.246023	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
332	26	86	790.00	Cab by nayab	2026-04-23 06:53:51.033859	2026-04-23 06:53:51.033859	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
333	26	87	150.00	Chips	2026-04-23 15:07:45.825249	2026-04-23 15:07:45.825249	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
334	26	87	420.00	Cold drinks 	2026-04-23 15:08:36.187237	2026-04-23 15:08:36.187237	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
335	26	87	164.00	Bus	2026-04-23 15:09:07.242004	2026-04-23 15:09:07.242004	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
336	26	87	350.00	T shirt	2026-04-23 15:09:28.184222	2026-04-23 15:09:28.184222	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
337	21	69	150.00	Lunch on 23 april	2026-04-23 20:12:03.190634	2026-04-23 20:12:03.190634	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
338	21	69	1319.00	Wonderla ticket	2026-04-23 20:12:10.71448	2026-04-23 20:12:10.71448	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
339	26	81	100.00	Corn 	2026-04-24 09:16:57.795615	2026-04-24 09:16:57.795615	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
340	26	81	70.00	Coke	2026-04-24 09:17:17.506171	2026-04-24 09:17:17.506171	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
341	26	85	70.00	Coke	2026-04-24 09:17:52.31736	2026-04-24 09:17:52.31736	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
343	26	80	1250.00	Baapis ki cab 	2026-04-24 09:23:54.24902	2026-04-24 09:23:54.24902	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
344	21	69	205.00	Sirf + snacks	2026-04-24 10:20:21.438161	2026-04-24 10:20:21.438161	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
345	24	76	175.00	Aaltu faltu nashta	2026-04-25 10:31:52.153661	2026-04-25 10:31:52.153661	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
346	24	77	160.00	Surf	2026-04-25 10:32:28.695192	2026-04-25 10:32:28.695192	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
347	24	76	60.00	Dosa delight lunch	2026-04-25 10:33:05.002925	2026-04-25 10:33:05.002925	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
348	23	74	450.00	Porter of 24 april	2026-04-25 15:48:24.919941	2026-04-25 15:48:24.919941	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
349	23	74	7270.00	Pending payment of 22 april on 25 april	2026-04-25 15:53:08.633497	2026-04-25 15:53:08.633497	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
350	24	77	150.00	Sun sandwich	2026-04-26 07:14:59.347678	2026-04-26 07:14:59.347678	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
351	21	69	150.00	sandwiches on 26 april	2026-04-26 09:46:43.332837	2026-04-26 09:46:43.332837	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
352	21	69	115.00	Marie + panipuri + ganne ka juice on 26	2026-04-27 16:28:31.449377	2026-04-27 16:28:31.449377	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
353	21	69	35.00	Dinner on 27 march	2026-04-27 16:28:59.801768	2026-04-27 16:28:59.801768	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
354	23	74	29060.00	Payment on 27 april	2026-04-27 16:53:36.928436	2026-04-27 16:53:36.928436	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
355	26	87	350.00	locker	2026-04-29 04:46:26.809996	2026-04-29 04:46:26.809996	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
356	21	69	40.00	Nashta on 28 and 29 april	2026-04-29 17:35:36.162198	2026-04-29 17:35:36.162198	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
357	24	76	100.00	DosaDelight thu	2026-04-30 13:50:20.02237	2026-04-30 13:50:20.02237	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
358	21	69	240.00	Mysore pak	2026-05-01 17:42:19.91379	2026-05-01 17:42:19.91379	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
359	21	69	100.00	Ganne ka juice + lunch on 1 may	2026-05-01 17:42:33.924004	2026-05-01 17:42:33.924004	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
360	21	69	500.00	Delivery to papa	2026-05-01 17:43:16.535042	2026-05-01 17:43:16.535042	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
361	27	88	140.00	Auto	2026-05-02 16:35:44.341066	2026-05-02 16:35:44.341066	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
362	27	88	210.00	Cold drink	2026-05-02 16:35:55.385526	2026-05-02 16:35:55.385526	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
363	27	89	250.00	Pizza + bus	2026-05-02 16:36:34.620948	2026-05-02 16:36:34.620948	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
364	27	90	75.00	Juic3	2026-05-02 16:36:46.899606	2026-05-02 16:36:46.899606	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
365	21	69	225.00	Belt + st. Thomas outung	2026-05-02 16:39:02.142361	2026-05-02 16:39:02.142361	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
366	21	69	16960.00	Rent of april	2026-05-05 09:29:24.58586	2026-05-05 09:29:24.58586	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
367	21	69	150.00	Chips + tel for travel	2026-05-06 07:40:19.613466	2026-05-06 07:40:19.613466	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
368	21	69	30.00	Bf on 5 may	2026-05-06 07:40:24.527678	2026-05-06 07:40:24.527678	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
369	21	69	14900.00	Flights for technovate	2026-05-07 13:18:46.462093	2026-05-07 13:18:46.462093	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
370	21	69	3000.00	Advance paid to Navpreet for pondicherry	2026-05-07 13:18:57.935395	2026-05-07 13:18:57.935395	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
371	30	93	3400.00	dinner	2026-05-07 14:53:38.019908	2026-05-07 14:53:38.019908	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
372	30	94	322.00	lunch	2026-05-07 14:53:46.280997	2026-05-07 14:53:46.280997	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
373	30	94	456.00		2026-05-07 14:53:52.745497	2026-05-07 14:53:52.745497	\N	\N	\N	f	\N	f	3	2026-05-21 18:10:15.728256
374	21	69	90.00	Nashta on 9 may(me and gautam)	2026-05-08 19:41:19.229295	2026-05-08 19:41:19.229295	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
375	30	94	202.00		2026-05-13 07:55:26.942078	2026-05-13 07:55:26.942078	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
376	17	61	2276.00	Print hard bound ,poster	2026-05-14 12:25:52.051058	2026-05-14 12:25:52.051058	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
377	17	60	260.00	Prints on sai	2026-05-14 12:26:15.594505	2026-05-14 12:26:15.594505	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
378	17	61	92.00	Mega bite on 14	2026-05-14 12:26:58.067043	2026-05-14 12:26:58.067043	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
379	17	60	80.00	Kunal ka	2026-05-14 12:27:46.706492	2026-05-14 12:27:46.706492	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
380	17	60	168.00	Chawal	2026-05-14 12:28:08.592571	2026-05-14 12:28:08.592571	\N	\N	\N	f	\N	f	1	2026-05-21 18:10:15.728256
381	17	60	3000.00	Gym	2026-05-14 12:29:01.243	2026-05-14 12:29:01.243	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
382	17	60	100.00	Mangi shake on 14	2026-05-14 14:02:31.529796	2026-05-14 14:02:31.529796	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
383	17	60	811.00	Social money	2026-05-17 11:34:29.190169	2026-05-17 11:34:29.190169	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
384	17	60	399.00	Pen drive	2026-05-17 11:34:39.697577	2026-05-17 11:34:39.697577	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
385	24	76	3100.00	Seema singh	2026-05-19 05:25:54.479255	2026-05-19 05:25:54.479255	\N	\N	\N	f	\N	f	1	2026-05-21 18:10:15.728256
386	21	69	190.00	Dinner + cd on 19 may	2026-05-20 03:07:48.486248	2026-05-20 03:07:48.486248	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
387	21	69	90.00	Bf on 20 may	2026-05-20 16:27:27.501073	2026-05-20 16:27:27.501073	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
388	24	77	95.00	Parth dinner pay kiya	2026-05-20 18:37:35.184869	2026-05-20 18:37:35.184869	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
389	21	69	30.00	Bf on 21 may	2026-05-21 03:38:15.892937	2026-05-21 03:38:15.892937	\N	\N	\N	f	\N	f	1	2026-05-21 18:10:15.728256
390	21	69	30.00	Cd and dahi on 21may	2026-05-21 17:35:04.758631	2026-05-21 17:35:04.758631	\N	\N	\N	f	\N	f	1	2026-05-21 18:10:15.728256
264	21	69	50.00	Dinner on 22 may	2026-04-06 14:10:33.898077	2026-04-06 14:10:33.898077	\N	\N	\N	f	\N	f	\N	2026-05-21 18:10:15.728256
391	21	69	50.00	Dinner on 22 may	2026-05-22 18:23:39.324053	2026-05-22 18:23:39.324053	\N	\N	\N	f	\N	f	\N	2026-05-22 18:23:39.324053
392	24	77	60.00	Lunch	2026-05-23 07:59:52.709716	2026-05-23 07:59:52.709716	\N	\N	\N	f	\N	f	\N	2026-05-23 07:59:52.709716
393	21	69	200.00	bf and lunch on 23 may adarsh also	2026-05-23 09:19:08.395272	2026-05-23 09:19:08.395272	\N	\N	\N	f	\N	f	1	2026-05-23 09:19:08.395272
394	21	69	860.00	Wonderla with t shirt	2026-05-23 09:20:36.524919	2026-05-23 09:20:36.524919	\N	\N	\N	f	\N	f	\N	2026-05-23 09:20:36.524919
395	24	77	95.00	Medicine	2026-05-23 18:50:58.181986	2026-05-23 18:50:58.181986	\N	\N	\N	f	\N	f	\N	2026-05-23 18:50:58.181986
396	31	95	45.00		2026-05-24 09:34:39.975997	2026-05-24 09:34:39.975997	\N	\N	\N	f	\N	f	\N	2026-05-24 09:34:39.975997
397	31	95	20.00		2026-05-24 11:13:07.05463	2026-05-24 11:13:07.05463	\N	\N	\N	f	\N	f	\N	2026-05-24 11:13:07.05463
398	24	77	50.00	Zepto	2026-05-24 17:42:59.480815	2026-05-24 17:42:59.480815	\N	\N	\N	f	\N	f	\N	2026-05-24 17:42:59.480815
399	24	77	28.00	Maggi zepto	2026-05-24 17:43:12.608866	2026-05-24 17:43:12.608866	\N	\N	\N	f	\N	f	\N	2026-05-24 17:43:12.608866
400	21	69	30.00	Bf on 25 may	2026-05-25 03:53:31.578106	2026-05-25 03:53:31.578106	\N	\N	\N	f	\N	f	\N	2026-05-25 03:53:31.578106
401	31	95	54.00		2026-05-25 18:13:03.115294	2026-05-25 18:13:03.115294	\N	\N	\N	f	\N	f	\N	2026-05-25 18:13:03.115294
402	4	12	678.00		2026-05-26 15:24:49.146479	2026-05-26 15:24:49.146479	\N	\N	\N	f	\N	f	\N	2026-05-26 15:24:49.146479
403	21	69	30.00	Bf on 26 may	2026-05-26 18:06:25.084657	2026-05-26 18:06:25.084657	\N	\N	\N	f	\N	f	\N	2026-05-26 18:06:25.084657
404	36	114	5.00	Ffv	2026-05-29 07:48:55.533923	2026-05-29 07:48:55.533923	\N	\N	\N	f	\N	f	1	2026-05-29 07:48:55.533923
405	36	114	3.00	Dinner	2026-05-29 07:49:13.230033	2026-05-29 07:49:13.230033	\N	\N	\N	f	\N	f	1	2026-05-29 07:49:13.230033
406	21	69	150.00	dosa delight bills	2026-06-02 15:49:48.040086	2026-06-02 15:49:48.040086	\N	\N	\N	f	\N	f	\N	2026-06-02 15:49:48.040086
407	21	69	55.00	commute for dal chini	2026-06-02 15:50:17.304958	2026-06-02 15:50:17.304958	\N	\N	\N	f	\N	f	\N	2026-06-02 15:50:17.304958
408	21	69	165.00	ice creams in olympia 	2026-06-02 15:50:40.903113	2026-06-02 15:50:40.903113	\N	\N	\N	f	\N	f	\N	2026-06-02 15:50:40.903113
409	35	100	10041.00	Cars 5441(Toyota) + 4600 (Nissan)	2026-06-02 16:39:32.764259	2026-06-02 16:39:32.764259	11	\N	\N	f	\N	f	\N	2026-06-02 16:39:32.764259
410	35	100	5850.00	Fuel - 3000 + 2850	2026-06-02 16:40:11.500634	2026-06-02 16:40:11.500634	11	\N	\N	f	\N	f	\N	2026-06-02 16:40:11.500634
411	35	100	300.00	Toll - 150 Magnite , 150 Toyota	2026-06-02 16:42:46.197505	2026-06-02 16:42:46.197505	11	\N	\N	f	\N	f	\N	2026-06-02 16:42:46.197505
412	35	100	470.00	cab + metro -Taking cars	2026-06-02 16:43:36.255912	2026-06-02 16:43:36.255912	11	\N	\N	f	\N	f	\N	2026-06-02 16:43:36.255912
413	35	100	600.00	Puncture	2026-06-02 16:44:19.083607	2026-06-02 16:44:19.083607	\N	\N	\N	f	\N	f	\N	2026-06-02 16:44:19.083607
414	35	100	920.00	Breakfast on 30th	2026-06-02 16:47:02.034822	2026-06-02 16:47:02.034822	\N	\N	\N	f	\N	f	\N	2026-06-02 16:47:02.034822
415	35	100	110.00	Water bottles at Pondicherry beach	2026-06-02 16:48:38.9922	2026-06-02 16:48:38.9922	\N	\N	\N	f	\N	f	\N	2026-06-02 16:48:38.9922
416	21	69	167.00	Soap ,toothpaste	2026-06-05 19:10:09.783969	2026-06-05 19:10:09.783969	\N	\N	\N	f	\N	f	\N	2026-06-05 19:10:09.783969
417	21	69	90.00	Food for vansh and shayak on leaving fay	2026-06-05 19:10:30.469792	2026-06-05 19:10:30.469792	\N	\N	\N	f	\N	f	\N	2026-06-05 19:10:30.469792
418	24	76	120.00	Surf	2026-06-06 04:48:14.093145	2026-06-06 04:48:14.093145	\N	\N	\N	f	\N	f	\N	2026-06-06 04:48:14.093145
419	21	69	200.00	lunch + bf on 6 june	2026-06-06 13:41:50.554586	2026-06-06 13:41:50.554586	\N	\N	\N	f	\N	f	\N	2026-06-06 13:41:50.554586
420	21	69	167.00	zepto 5 june sarf, sabun	2026-06-06 13:42:09.795735	2026-06-06 13:42:09.795735	\N	\N	\N	f	\N	f	\N	2026-06-06 13:42:09.795735
421	21	69	360.00	jersey	2026-06-06 13:42:45.98118	2026-06-06 13:42:45.98118	\N	\N	\N	f	\N	f	\N	2026-06-06 13:42:45.98118
422	21	69	16979.00	rent of june	2026-06-06 13:42:59.781168	2026-06-06 13:42:59.781168	\N	\N	\N	f	\N	f	\N	2026-06-06 13:42:59.781168
423	21	69	90.00	Dinner on 7 june	2026-06-06 18:47:55.928435	2026-06-06 18:47:55.928435	\N	\N	\N	f	\N	f	\N	2026-06-06 18:47:55.928435
424	21	69	622.00	Manohar + zepto for papa	2026-06-08 06:08:33.779792	2026-06-08 06:08:33.779792	\N	\N	\N	f	\N	f	\N	2026-06-08 06:08:33.779792
425	21	69	4000.00	For food till 20 june 	2026-06-08 06:08:48.206339	2026-06-08 06:08:48.206339	\N	\N	\N	f	\N	f	\N	2026-06-08 06:08:48.206339
426	21	69	70.00	Lunch on 7 june	2026-06-08 06:10:51.659291	2026-06-08 06:10:51.659291	\N	\N	\N	f	\N	f	\N	2026-06-08 06:10:51.659291
427	21	69	30.00	Bf on 8 june	2026-06-08 06:10:59.237893	2026-06-08 06:10:59.237893	\N	\N	\N	f	\N	f	\N	2026-06-08 06:10:59.237893
428	21	69	129.00	Zepto on 8 june	2026-06-08 18:06:35.425593	2026-06-08 18:06:35.425593	\N	\N	\N	f	\N	f	\N	2026-06-08 18:06:35.425593
429	21	69	30.00	bf on 9 June	2026-06-09 15:11:41.348899	2026-06-09 15:11:41.348899	\N	\N	\N	f	\N	f	\N	2026-06-09 15:11:41.348899
430	21	69	90.00	Bf on 10 june	2026-06-10 16:49:24.767427	2026-06-10 16:49:24.767427	\N	\N	\N	f	\N	f	\N	2026-06-10 16:49:24.767427
431	21	69	30.00	Bf on 12 june	2026-06-12 18:39:00.956282	2026-06-12 18:39:00.956282	\N	\N	\N	f	\N	f	\N	2026-06-12 18:39:00.956282
432	21	69	1050.00	Paid for pondi alchol	2026-06-12 18:39:32.653287	2026-06-12 18:39:32.653287	\N	\N	\N	f	\N	f	\N	2026-06-12 18:39:32.653287
433	21	69	250.00	Paid to Navpreet for pondi settlements	2026-06-12 18:39:56.51348	2026-06-12 18:39:56.51348	\N	\N	\N	f	\N	f	\N	2026-06-12 18:39:56.51348
434	21	69	80.00	Bf + lunch on match day	2026-06-13 17:42:41.182574	2026-06-13 17:42:41.182574	\N	\N	\N	f	\N	f	\N	2026-06-13 17:42:41.182574
435	21	69	124.00	Zepto on 13 june	2026-06-13 17:43:17.09723	2026-06-13 17:43:17.09723	\N	\N	\N	f	\N	f	\N	2026-06-13 17:43:17.09723
436	21	69	30.00	bf on 17 Jun	2026-06-17 16:10:08.488577	2026-06-17 16:10:08.488577	\N	\N	\N	f	\N	f	\N	2026-06-17 16:10:08.488577
437	21	69	117.00	zepto on 17 june	2026-06-18 00:00:00	2026-06-18 18:26:04.07032	\N	\N	\N	f	\N	f	\N	2026-06-18 18:26:04.07032
438	21	69	30.00	Bf on 18 june	2026-06-18 00:00:00	2026-06-18 18:26:11.881546	\N	\N	\N	f	\N	f	\N	2026-06-18 18:26:11.881546
439	30	93	66.00	jh	2026-07-02 00:00:00	2026-07-02 15:27:48.548294	\N	\N	\N	f	\N	f	\N	2026-07-02 15:27:48.548294
\.


--
-- Data for Name: friends; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.friends (id, user_id, name, username, email, phone, mobile, created_at, updated_at) FROM stdin;
1	17	Garv Behl	golu	behlgarv2004@gmail.com			2025-12-30 19:18:51.869352	2025-12-30 19:18:51.869352
3	17	Archit	archit	architm14@gmail.com			2025-12-31 09:24:58.409833	2025-12-31 09:24:58.409833
4	17	ball	blu	ballu@gmail.com			2025-12-31 15:49:54.639998	2025-12-31 15:49:54.639998
5	17	Archit	arc	archit.m14@gmail.com			2025-12-31 19:24:33.493021	2025-12-31 19:24:33.493021
6	17	krish	kk	kk@gmail.com			2026-01-01 16:22:08.044636	2026-01-01 16:22:08.044636
\.


--
-- Data for Name: otps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otps (id, email, code, purpose, expires_at, used, created_at, attempts) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, user_id, token_hash, device_hint, created_at, expires_at, last_used_at, revoked) FROM stdin;
5	16	448bef86837cc8be111fa379cbf4b2d03b45c0ab16f979a5718de88c5e1ba81e	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.	2026-05-24 10:02:52.937769	2026-07-23 10:02:52.859	2026-05-24 10:02:52.937769	f
8	18	ff57f78d7f9145c212eb1eed96b5121d37e8d17843883f0edd3cd547dc2a504f	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.	2026-05-25 18:12:55.843997	2026-07-24 23:42:55.427	2026-05-25 18:12:55.843997	f
9	23	33c217cdd71b41645d0a78e29a807e15ac1f315793636088d431a44803fb8b8b	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Sa	2026-05-25 19:19:23.057801	2026-07-24 19:19:22.98	2026-05-25 19:19:23.057801	f
11	15	7e70271aa9ea89c9dbfc929e3108092327ff514161b3021fadf380d296421613	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.	2026-05-26 15:24:10.874753	2026-07-25 20:54:10.743	2026-05-26 15:24:10.874753	f
12	27	b2342857b201cf1dd483f2157769d69beb0df96d533ac5e208ba9418cd96c0b3	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Sa	2026-05-29 07:48:13.290052	2026-07-28 07:48:13.21	2026-05-29 07:48:13.290052	f
13	23	43829c1e383c6cea48da187308e679443d0f5a5568abbb9a20b295bcebfccaaf	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Sa	2026-05-31 19:18:29.773034	2026-07-30 19:18:29.692	2026-05-31 19:18:29.773034	f
14	17	386593053bee0d80156f6d6722295a6c58aab28341e5a98098191ad9f263a4b3	Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mob	2026-06-06 15:02:54.020564	2026-08-05 20:32:53.932	2026-06-06 15:02:54.020564	f
15	17	0ba145f41d8a34c13912c890ad4bf4406741e011e57ecc1708df254aa0989a51	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.	2026-06-06 15:44:12.988021	2026-08-05 15:44:12.906	2026-06-06 15:44:12.988021	f
16	25	95e8f1cb2858c04bdc504a194d9a110e90aa8e6ed0d7d05ab3cc286b21b50ed6	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Sa	2026-06-06 16:31:38.082939	2026-08-05 16:31:38.001	2026-06-06 16:31:38.082939	f
17	17	bfbdbc30cc541c6b0ef39f2a6f22f9133448041a5f8f036c19e11f95c457584f	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Sa	2026-06-06 18:47:37.287727	2026-08-05 18:47:37.2	2026-06-06 18:47:37.287727	f
18	28	9b3a628db3ceb4bb7f022a289e3b2ad4d29ca5ed036f555af596120f06ea3e10	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Sa	2026-06-11 11:00:52.150103	2026-08-10 11:00:52.132	2026-06-11 11:00:52.150103	f
19	29	84b5edc995f19d5174178287f3798d969202628b3e3c8bdd8de635de18d24ad9	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Sa	2026-06-11 12:55:25.863852	2026-08-10 12:55:25.776	2026-06-11 12:55:25.863852	f
20	17	07c22c33f7493a7d1643e0fe7aa083e0bd842c0f7630bd5e0e950784240d8cf8	Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mob	2026-06-16 15:16:52.051795	2026-08-15 20:46:51.947	2026-06-16 15:16:52.051795	f
21	17	b17e6bfcb951ed8dbcf570a94625ddc7051949ecd303eb8c1a7192f01728e4d3	Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mob	2026-06-16 15:29:00.250285	2026-08-15 20:59:00.151	2026-06-16 15:29:00.250285	f
22	17	013dd176664f70a003a96b17f2a551e9591c053b3b4641f37931ff7b6e01565f	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.	2026-06-17 15:51:51.377275	2026-08-16 21:21:51.183	2026-06-17 15:51:51.377275	f
23	17	7d831cf6cf1b1b41769ab222a7624ee425c2ac34797ac628cdd0b3c0034dc2c2	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.	2026-06-17 16:05:14.141262	2026-08-16 21:35:13.91	2026-06-17 16:05:14.141262	f
24	17	435ba2a2eac4b33883dd470bdd72b9b4ddfc747dc14015f53c6ab0a7006c4562	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.	2026-06-18 17:01:44.698892	2026-08-17 22:31:44.437	2026-06-18 17:01:44.698892	f
25	17	a5b893487f10c4f2d6d2e3a795bab03c40c0b7cbd41b5ed669be1208400e1fc3	819ba0904f7a5cba922d093e569afe4d302f4613058b2bbcfe411abcc4fbc792	2026-07-02 14:06:09.940777	2026-08-31 19:36:09.869	2026-07-02 14:06:09.940777	f
26	17	3357603fb571703ff2110acac45c625765e06ce49672dfd59ebf836ad584042e	1272f03743143f1f36253f1f77150f43ae9962d080d2a63ce7ec0cd5f21b4aa9	2026-07-02 14:06:50.519631	2026-08-31 19:36:50.451	2026-07-02 14:06:50.519631	f
27	17	89d2f971329eb54c1bd7c29c03746a951748436c92a0025166982b11fc3d4361	703b2a9e5059aedc0b857b89693bd4b65ea7aaf05bab3360c96f4549363a30c6	2026-07-02 14:10:22.061713	2026-08-31 19:40:21.947	2026-07-02 14:10:22.061713	f
28	17	03e96c968d2af5b04eb2001dda4c007f710d08c17091424069cf22ea0ea09481	f88d708daaf22b6c95b23a10f06d6c09ba58b54dd229b82a9ee62c38a85f4cef	2026-07-02 14:10:59.013717	2026-08-31 19:40:58.939	2026-07-02 14:10:59.013717	f
29	17	74bef3e9fec47b565cedb3087c0a1a21c4b645e1e14508a043b76d52de2407d8	92e846393149a0d3aa685c6f5506e82f972cd444a53230badfa141e9ae74f76f	2026-07-02 14:11:37.63873	2026-08-31 19:41:37.563	2026-07-02 14:11:37.63873	f
30	17	f807c9396b3185da8cae1fc6a35742fbbdf423e4e4c46907b3f6e09a33bdfb66	b5017bb718b685c747f679dd50275209b934657d1ee3fa0c4e692447e0902fe1	2026-07-02 14:22:04.453728	2026-08-31 19:52:04.38	2026-07-02 14:22:04.453728	f
31	17	8ad338249ce2ec37fa24bf4e4f7f2463fef0d5f3a9f87a42ef29f189e89d73d3	0807ff6adaaf24ba101a5c85076b6e7326b2bd64c6e79af27110fde2cd524085	2026-07-02 14:28:04.859995	2026-08-31 19:58:04.786	2026-07-02 14:28:04.859995	f
32	17	3f4f90069f976d9dce3dc7e99b111fdd7d279a94e0ef92a597af44ec2cd23c47	897ecf28ce82b76b6fe19cccadbedaf322d2cf95872b9ca03fc9d1917c34749e	2026-07-02 14:28:42.590719	2026-08-31 19:58:42.512	2026-07-02 14:28:42.590719	f
33	17	f338bba96bd8a45ec167a27febb8abc78f3137078e3dc3f54a118fe0e551c3da	90b3227ce21f489a290c90d6ea14c590dfdc4c1854c1574a6ce9950437b071fa	2026-07-02 14:29:59.282586	2026-08-31 19:59:59.18	2026-07-02 14:29:59.282586	f
34	17	2e0708564349c599b2709a10396faab6ed69bcd6c9ce525982bd709d41d0c862	f00c46ea1cb9a3db0120b89c5405876656fa48b6779e1bf415a7582a9c70c853	2026-07-02 14:31:10.522251	2026-08-31 20:01:10.449	2026-07-02 14:31:10.522251	f
35	17	b94902d28394d63c6a6eb9fb42c41b07166a54782b7d808bacaa110eda267205	957dc0513e65c6ea2c37adf36947a0e5b56cf9ccff22d31f1b1316f441cab804	2026-07-02 14:31:26.789704	2026-08-31 20:01:26.716	2026-07-02 14:31:26.789704	f
36	17	1e144b2d3cfd186a507edd3199783f3c9935cd2bf5acd483a1fd00d679132fad	82b58622a73b5bb4940249619e95cc17974667691bccf898bffe07dc7e781848	2026-07-02 14:35:50.433645	2026-08-31 20:05:50.361	2026-07-02 14:35:50.433645	f
37	17	44ad955d0da8ae9b2d328bb037e8f415fdb60ca244d42c5d142102a4c9aa8f75	4fbe295d9f3dba25ef3ad948efdf87cff7f8e2d9af443eb17a81b2f704e2e638	2026-07-02 14:36:42.289847	2026-08-31 20:06:42.218	2026-07-02 14:36:42.289847	f
38	17	6a7c8e2f3f53cd37f2abfd38bc254890c48427d12ea35418b8d74a6db1e8251c	968669c241e897b7997193f97063a674b8109488e65ee44070cbe5516076f708	2026-07-02 14:38:41.488898	2026-08-31 20:08:40.704	2026-07-02 14:38:41.488898	f
39	15	15085d6c93e1f7ea907f1de12c66423e813d60f0c5b7c6ae4142bc0a78edf0bc	ec9636aa152c51b7d525a40ef666daaf45b267923ca1370a1fce7084fe3b54f0	2026-07-02 14:39:45.966707	2026-08-31 20:09:45.903	2026-07-02 14:39:45.966707	f
40	15	a5a33300e04a5f9acf03f8da2733e82f63a1a9b9d6383eb5dca7347a6a3ebd2f	871c670de014ff309d31cb522402439b844d4e3c720814bb1343fa2fa3709b59	2026-07-02 14:41:08.224666	2026-08-31 20:11:08.162	2026-07-02 14:41:08.224666	f
41	15	880788384b597afab684cb579c82a14969e01e23079dc6b27d65d81eb6bc65c6	0d9cb8c7f5e0a7827bb0e5dab0de2602062bc568797eabe2b817a77e51e8e511	2026-07-02 14:47:31.187101	2026-08-31 20:17:31.113	2026-07-02 14:47:31.187101	f
42	15	d2c2bfac0f1f13b0f0e568d2675e5e5e5cfc288f9983ed9abebbfc972e42f462	b96ddb76f5f57eb3a3514df11745e3a4b3e4edad0d7aea55c5bd7168ccfa44c9	2026-07-02 14:48:17.711847	2026-08-31 20:18:17.617	2026-07-02 14:48:17.711847	f
43	15	81076e0683f15ff648214b8edb8f71220e10a905c10621e4fb53b5d9f112d607	79716e40db0e6432d943468ddd8e4432de3ae3f948047027e621a80c3b97ee83	2026-07-02 14:50:29.776817	2026-08-31 20:20:29.713	2026-07-02 14:50:29.776817	f
44	15	3d5a9b3b6cc2cceeb1d5f5d4c91b4ea1a9eddd571e23ec5f1ab66f97a2e7ec8e	31628444df003cdc15b3cf9dcb06fd525f1bc51556b795fc12c17e96874ab37c	2026-07-02 14:50:49.683215	2026-08-31 20:20:49.621	2026-07-02 14:50:49.683215	f
45	15	10d38cb11007d108d2a270878f23f28219bcddb01533ca4026881b0c5784f474	053759cd6a6558c4ed8f5a6c56307f250cdd393452a8abc716465ad24158a643	2026-07-02 14:54:13.768108	2026-08-31 20:24:13.691	2026-07-02 14:54:13.768108	f
46	17	2759e9e862cbdd616aad3f1fdfad4f86dcac844e00f492b8badb8fa9e5d8d0e0	ff4a90830ec7e7bbc9c1de7444beebbe4d83ffd58206c7cb3706c23cfbcdae46	2026-07-02 14:54:46.306285	2026-08-31 20:24:46.227	2026-07-02 14:54:46.306285	f
\.


--
-- Data for Name: settlement_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settlement_records (id, chapter_id, event_id, from_member_id, to_member_id, amount, marked_by, note, status, marked_at, created_at) FROM stdin;
1	26	\N	82	79	16.57	17		settled	2026-05-10 12:55:40.059724	2026-05-10 12:55:40.059724
2	26	\N	84	79	479.89	17		settled	2026-05-10 12:55:48.822136	2026-05-10 12:55:48.822136
3	26	\N	83	79	190.64	17		settled	2026-05-10 12:56:03.40902	2026-05-10 12:56:03.40902
4	26	\N	85	87	598.88	17		settled	2026-05-12 18:47:27.980057	2026-05-12 18:47:27.980057
5	26	\N	83	87	375.26	17		settled	2026-05-12 18:47:37.606633	2026-05-12 18:47:37.606633
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, real_name, username, email, password_hash, provider, google_id, last_login_at, needs_password, created_at, updated_at, jwt_generation) FROM stdin;
8	Ali Raza	razaa36227	razaa36227@gmail.com	\N	google	103483547136308898325	2025-12-16 09:08:12.541+00	f	2025-12-16 09:07:43.649412+00	2025-12-16 09:08:12.552875+00	0
20	Krish Kalra	kalrakrish588	kalrakrish588@gmail.com	$2b$10$2q29tgrR0lEq01kHWCtfVu3nLzmSv.mdFEgCnxlEzVlN4eyDIx9Fa	local	\N	2026-01-01 15:30:11.54+00	f	2026-01-01 15:30:10.659277+00	2026-01-01 15:30:10.659277+00	0
9	Riya Garg	riyagarg1215	riyagarg1215@gmail.com	\N	google	104006256371597273663	2026-01-08 08:09:28.309+00	f	2025-12-16 14:00:13.463869+00	2026-01-08 08:09:28.391561+00	0
15	Anil Bhatia	parthenterprises099	parthenterprises099@gmail.com	\N	google	103248926896065126258	2025-12-26 18:51:38.003+00	f	2025-12-18 15:29:26.021558+00	2026-05-26 15:23:38.660739+00	1
27	Sayak Mukherjee	\N	sayak.barcelona@gmail.com	\N	google	113758177821801943855	2026-05-29 07:48:12.942+00	f	2026-05-29 07:48:13.02262+00	2026-05-29 07:48:13.02262+00	0
17	Parth Bhatia	pkbhatia7777	parthbhatia7777@gmail.com	$2b$10$.kgJs3KnVLdBeRPOGlcG7.q8TfHonNZWZuMWsFJ.9lYABgE/yryRy	local	105049613952418445045	2026-06-06 15:02:53.872+00	f	2025-12-18 18:49:21.907109+00	2026-06-06 15:02:53.959658+00	0
21	Dev Jain	jaindev12022005	jaindev12022005@gmail.com	$2b$10$TJWzb6PJdh9XJTX87stgYe1HjOgRLpoRjKfi7t6nldKak/jadfRBu	local	\N	2026-02-02 07:51:26.197+00	f	2026-02-02 07:51:25.297071+00	2026-02-02 07:51:25.297071+00	0
25	Navpreet Singh	\N	navi2005saini@gmail.com	\N	google	102100821433192784678	2026-06-06 16:31:37.819+00	f	2026-05-02 12:35:37.422068+00	2026-06-06 16:31:37.901733+00	0
22	VANSH SACHDEVA	\N	vsachdeva_be22@thapar.edu	\N	google	117722571671651887685	2026-04-10 09:21:32.965+00	f	2026-04-10 09:20:50.237374+00	2026-04-10 09:21:33.045603+00	0
28	Pratik Mishra	\N	pratikmishra.edu@gmail.com	\N	google	110394167976956278979	2026-06-11 11:00:51.927+00	f	2026-06-11 11:00:51.927954+00	2026-06-11 11:00:51.927954+00	0
24	Vansh Sachdeva	\N	vanshsachdeva900@gmail.com	\N	google	113517472282495484283	2026-04-18 14:26:43.703+00	f	2026-04-18 14:26:11.102257+00	2026-04-18 14:26:43.783154+00	0
29	Abishek R	\N	abishekrk044@gmail.com	\N	google	116747924554753697696	2026-06-11 12:55:25.565+00	f	2026-06-11 12:55:25.652865+00	2026-06-11 12:55:25.652865+00	0
26	Garv	\N	garv60127@gmail.com	\N	google	113554427652446108282	2026-05-14 06:18:08.639+00	f	2026-05-14 06:10:35.063422+00	2026-05-14 06:18:08.720737+00	0
19	Garv Behl	behlgarv	behlgarv@gmail.com	\N	google	109229196456103818387	2026-05-15 14:28:42.158+00	f	2025-12-21 18:54:27.953535+00	2026-05-15 14:28:42.237981+00	0
16	Anil Bhatia	akb	anilbhatia3868@gmail.com	$2b$10$Ha3iQCTNpDLzx5idAg623.tr2nfB.uwej9l2.FWxsPqiFgeieC90.	local	102639229819063095802	2026-05-22 17:05:41.421+00	f	2025-12-18 15:37:21.064616+00	2026-05-24 10:02:16.462996+00	1
18	Mystify Official	mystifyofficial01	mystifyofficial01@gmail.com	\N	google	112049372023841567918	2026-05-13 07:58:27.55+00	f	2025-12-21 11:55:09.278111+00	2026-05-25 18:12:23.01581+00	3
23	Adarsh Thakur	\N	er.adarshthakur@gmail.com	\N	google	111075706416522567442	2026-05-25 19:19:22.816+00	f	2026-04-10 09:23:24.441815+00	2026-05-25 19:19:22.893459+00	1
\.


--
-- Name: chapter_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chapter_members_id_seq', 116, true);


--
-- Name: chapters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chapters_id_seq', 38, true);


--
-- Name: device_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.device_sessions_id_seq', 55, true);


--
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.events_id_seq', 11, true);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expense_categories_id_seq', 7, true);


--
-- Name: expense_splits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expense_splits_id_seq', 889, true);


--
-- Name: expenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expenses_id_seq', 439, true);


--
-- Name: friends_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.friends_id_seq', 6, true);


--
-- Name: otps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otps_id_seq', 221, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.refresh_tokens_id_seq', 46, true);


--
-- Name: settlement_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.settlement_records_id_seq', 7, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 29, true);


--
-- Name: chapter_members chapter_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_members
    ADD CONSTRAINT chapter_members_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: device_sessions device_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_pkey PRIMARY KEY (id);


--
-- Name: device_sessions device_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_session_id_key UNIQUE (session_id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expense_splits expense_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_splits
    ADD CONSTRAINT expense_splits_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: friends friends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_pkey PRIMARY KEY (id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: settlement_records settlement_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_records
    ADD CONSTRAINT settlement_records_pkey PRIMARY KEY (id);


--
-- Name: expense_categories unique_category_per_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT unique_category_per_user UNIQUE (user_id, name);


--
-- Name: friends unique_user_friend_username; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT unique_user_friend_username UNIQUE (user_id, username);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_chapter_members_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_members_chapter_id ON public.chapter_members USING btree (chapter_id);


--
-- Name: idx_chapter_members_friend_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_members_friend_id ON public.chapter_members USING btree (friend_id);


--
-- Name: idx_chapter_members_user_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_members_user_chapter ON public.chapter_members USING btree (user_id, chapter_id);


--
-- Name: idx_chapter_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapter_members_user_id ON public.chapter_members USING btree (user_id);


--
-- Name: idx_chapters_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_created_by ON public.chapters USING btree (created_by);


--
-- Name: idx_chapters_data_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_data_updated ON public.chapters USING btree (created_by, data_updated_at DESC);


--
-- Name: idx_device_sessions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_session_id ON public.device_sessions USING btree (session_id);


--
-- Name: idx_device_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_user ON public.device_sessions USING btree (user_id);


--
-- Name: idx_device_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_device_sessions_user_active ON public.device_sessions USING btree (user_id, last_active_at DESC);


--
-- Name: idx_events_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_chapter_id ON public.events USING btree (chapter_id);


--
-- Name: idx_events_chapter_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_events_chapter_status ON public.events USING btree (chapter_id, status);


--
-- Name: idx_expense_categories_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_categories_user ON public.expense_categories USING btree (user_id);


--
-- Name: idx_expense_splits_member_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_splits_member_id ON public.expense_splits USING btree (member_id);


--
-- Name: idx_expenses_chapter_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_chapter_created ON public.expenses USING btree (chapter_id, created_at DESC);


--
-- Name: idx_expenses_chapter_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_chapter_date ON public.expenses USING btree (chapter_id, expense_date DESC);


--
-- Name: idx_expenses_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_chapter_id ON public.expenses USING btree (chapter_id);


--
-- Name: idx_expenses_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_event_id ON public.expenses USING btree (event_id);


--
-- Name: idx_friends_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friends_user_id ON public.friends USING btree (user_id);


--
-- Name: idx_otps_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otps_email ON public.otps USING btree (email);


--
-- Name: idx_otps_email_purpose; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otps_email_purpose ON public.otps USING btree (email, purpose);


--
-- Name: idx_refresh_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_settlement_records_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlement_records_chapter ON public.settlement_records USING btree (chapter_id);


--
-- Name: idx_settlement_records_chapter_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlement_records_chapter_status ON public.settlement_records USING btree (chapter_id, status);


--
-- Name: idx_settlement_records_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlement_records_event ON public.settlement_records USING btree (event_id);


--
-- Name: idx_settlement_records_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlement_records_from ON public.settlement_records USING btree (from_member_id);


--
-- Name: idx_settlement_records_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_settlement_records_to ON public.settlement_records USING btree (to_member_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_jwt_gen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_jwt_gen ON public.users USING btree (id, jwt_generation);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: otps_email_purpose_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX otps_email_purpose_unique ON public.otps USING btree (email, purpose);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: expenses trg_expenses_update_chapter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_expenses_update_chapter AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_chapter_data_timestamp();


--
-- Name: settlement_records trg_settlements_update_chapter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_settlements_update_chapter AFTER INSERT OR DELETE OR UPDATE ON public.settlement_records FOR EACH ROW EXECUTE FUNCTION public.update_chapter_data_timestamp();


--
-- Name: chapter_members chapter_members_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_members
    ADD CONSTRAINT chapter_members_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapter_members chapter_members_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_members
    ADD CONSTRAINT chapter_members_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.friends(id) ON DELETE SET NULL;


--
-- Name: chapter_members chapter_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_members
    ADD CONSTRAINT chapter_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chapters chapters_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: device_sessions device_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_sessions
    ADD CONSTRAINT device_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: events events_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: expense_categories expense_categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: expense_splits expense_splits_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_splits
    ADD CONSTRAINT expense_splits_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;


--
-- Name: expense_splits expense_splits_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_splits
    ADD CONSTRAINT expense_splits_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.chapter_members(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_payer_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_payer_member_id_fkey FOREIGN KEY (payer_member_id) REFERENCES public.chapter_members(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_source_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_source_chapter_id_fkey FOREIGN KEY (source_chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_source_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_source_member_id_fkey FOREIGN KEY (source_member_id) REFERENCES public.chapter_members(id) ON DELETE SET NULL;


--
-- Name: friends friends_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friends
    ADD CONSTRAINT friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: settlement_records settlement_records_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_records
    ADD CONSTRAINT settlement_records_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: settlement_records settlement_records_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_records
    ADD CONSTRAINT settlement_records_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: settlement_records settlement_records_from_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_records
    ADD CONSTRAINT settlement_records_from_member_id_fkey FOREIGN KEY (from_member_id) REFERENCES public.chapter_members(id) ON DELETE CASCADE;


--
-- Name: settlement_records settlement_records_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_records
    ADD CONSTRAINT settlement_records_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: settlement_records settlement_records_to_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settlement_records
    ADD CONSTRAINT settlement_records_to_member_id_fkey FOREIGN KEY (to_member_id) REFERENCES public.chapter_members(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Qkw0s3scP0TspEfnMEfd6fBp5HiAPunJVdjPsNcipUgtwaWO3WP924c4o5sePin

