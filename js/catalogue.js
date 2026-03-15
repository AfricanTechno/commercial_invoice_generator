// ============================================================
// Product Catalogue — edit this file to add/remove/update products.
// No application logic here, only data.
// ============================================================

var CATALOGUE = {
  // Eyewear
  "Ray-Ban Meta Sunglasses":        { hs: "9004.10.3",  unit: 299.00,  sku: "" },
  "Oakley Meta Sunglasses":         { hs: "9004.10.3",  unit: 499.00,  sku: "" },
  "Even Reality E1 Smart Glasses":  { hs: "9004.10.3",  unit: 599.00,  sku: "" },

  // VR / Gaming — headsets as consoles
  "Meta Quest 3S 128GB VR Gaming Console": { hs: "9504.50.90", unit: 299.99, sku: "SK-1000203-01" },
  "Meta Quest 3S 256GB VR Gaming Console": { hs: "9504.50.90", unit: 399.99, sku: "SK-1000209-01" },
  "Meta Quest 3 512GB VR Gaming Console":  { hs: "9504.50.90", unit: 499.99, sku: "SK-1000189-01" },
  "Bigscreen Beyond 2 VR Headset":         { hs: "9504.50.90", unit: 0,      sku: "" },
  "HTC VIVE Pro 2 Full Kit":               { hs: "9504.50.90", unit: 1100.00, sku: "" },

  // VR Accessories
  "Meta Quest 2 Controllers":               { hs: "9504.90", unit: 69.99,  sku: "" },
  "Meta Quest 3 Carrying Case":             { hs: "9504.90", unit: 69.99,  sku: "SK-1000045-01" },
  "Meta Quest 3/3S Compact Carrying Case":  { hs: "9504.90", unit: 69.99,  sku: "SK-1000044-01" },
  "Meta Quest 3 Elite Strap":               { hs: "9504.90", unit: 129.99, sku: "899-00510-01" },
  "Meta Quest 3 Elite Strap with Battery":  { hs: "9504.90", unit: 149.99, sku: "899-00560-02" },
  "Meta Quest 3 Silicone Facial Interface":  { hs: "9504.90", unit: 49.99,  sku: "" },
  "Meta Quest Link Cable":                  { hs: "9504.90", unit: 79.99,  sku: "" },
  "Bigscreen Beyond 2 Cover Shell":         { hs: "9504.90", unit: 0,      sku: "" },
  "Bigscreen Beyond 2 Custom-Fit Cushion":  { hs: "9504.90", unit: 0,      sku: "" },
  "Bigscreen Beyond 2 Audio Strap":         { hs: "9504.90", unit: 0,      sku: "" },

  // Cameras & Accessories
  "Insta360 Mic Air (1 TX + 1 RX)":       { hs: "8518.10.00", unit: 0,     sku: "CINSABWA" },
  "Insta360 Bullet Time Cord":             { hs: "9620.00.25", unit: 0,     sku: "CINX2CB/C" },
  "Insta360 X5 Replacement Lens Kit":      { hs: "8529.90.90", unit: 0,     sku: "CINSBAHB" },
  "Insta360 Xplorer Grip Kit for Insta360 Ace Pro 2/Insta360 Ace Pro": { hs: "9620.00.25", unit: 0, sku: "CINSABGW" },
  "Insta360 Quick Release Mount":          { hs: "9620.00.25", unit: 39.99, sku: "" },
  "Insta360 Bike Computer Mount (Independent Handlebars)": { hs: "9006.91.00", unit: 0, sku: "" },
  "Camera Base / Base Plate":              { hs: "9006.91.00", unit: 0,     sku: "" },

  // 3D / Scanners
  "RANGE 2 3D Scanner": { hs: "9031.49.90", unit: 621.62, sku: "" },

  // Other
  "Even R1 Sizing Kit (Plastic Rings)": { hs: "3926.90.90", unit: 0, sku: "" }
};

// Category groupings for the product dropdown
var CATALOGUE_GROUPS = [
  { label: "Eyewear", items: [
    "Ray-Ban Meta Sunglasses",
    "Oakley Meta Sunglasses",
    "Even Reality E1 Smart Glasses"
  ]},
  { label: "VR / Gaming", items: [
    "Meta Quest 3S 128GB VR Gaming Console",
    "Meta Quest 3S 256GB VR Gaming Console",
    "Meta Quest 3 512GB VR Gaming Console",
    "Bigscreen Beyond 2 VR Headset",
    "HTC VIVE Pro 2 Full Kit"
  ]},
  { label: "VR Accessories", items: [
    "Meta Quest 2 Controllers",
    "Meta Quest 3 Carrying Case",
    "Meta Quest 3/3S Compact Carrying Case",
    "Meta Quest 3 Elite Strap",
    "Meta Quest 3 Elite Strap with Battery",
    "Meta Quest 3 Silicone Facial Interface",
    "Meta Quest Link Cable",
    "Bigscreen Beyond 2 Cover Shell",
    "Bigscreen Beyond 2 Custom-Fit Cushion",
    "Bigscreen Beyond 2 Audio Strap"
  ]},
  { label: "Cameras & Accessories", items: [
    "Insta360 Mic Air (1 TX + 1 RX)",
    "Insta360 Bullet Time Cord",
    "Insta360 X5 Replacement Lens Kit",
    "Insta360 Xplorer Grip Kit for Insta360 Ace Pro 2/Insta360 Ace Pro",
    "Insta360 Quick Release Mount",
    "Insta360 Bike Computer Mount (Independent Handlebars)",
    "Camera Base / Base Plate"
  ]},
  { label: "3D / Scanners", items: [
    "RANGE 2 3D Scanner"
  ]},
  { label: "Other", items: [
    "Even R1 Sizing Kit (Plastic Rings)"
  ]}
];
