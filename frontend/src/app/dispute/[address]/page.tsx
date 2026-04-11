export default function Dispute({ params }: { params: { address: string } }) {
  return (
    <main>
      <h1>Dispute for Deal {params.address}</h1>
      {/* Dispute panel will go here */}
    </main>
  )
}
