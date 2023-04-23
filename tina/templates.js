export function owl_postFields() {
  return [
    {
      type: "string",
      name: "headline",
      label: "Post Subject",
    },
    {
      type: "datetime",
      name: "date",
      label: "Date",
      required: true,
    },
  ];
}
export function postFields() {
  return [
    {
      type: "string",
      name: "headline",
      label: "Post Subject",
      required: true,
    },
    {
      type: "string",
      name: "content",
      label: "Content",
      ui: {
        component: "textarea",
      },
      required: true,
    },
  ];
}
