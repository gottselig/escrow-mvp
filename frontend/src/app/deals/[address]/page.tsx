export default function DealDetail({ params }: { params: { address: string } }) {
  return (
    <main>
      <h1>Deal {params.address}</h1>
      {/* Deal details will go here */}
    </main>
  )
}
