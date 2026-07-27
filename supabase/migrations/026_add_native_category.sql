-- Migration 026: Add "Australian natives" as a product category
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'flowers_native';
