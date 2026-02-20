import { createSignal } from 'solid-js'
import Button from '../components/Button'
import { Header } from '../components/Header'
import Input from '../components/Input'
import { PlayerList } from '../components/PlayerList'
import Select from '../components/Select'

const americanCountries = [
  { value: 'AR', label: 'Argentina' },
  { value: 'BS', label: 'Bahamas' },
  { value: 'BB', label: 'Barbados' },
  { value: 'BZ', label: 'Belize' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'CA', label: 'Canada' },
  { value: 'CL', label: 'Chile' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'CU', label: 'Cuba' },
  { value: 'DM', label: 'Dominica' },
  { value: 'DO', label: 'Dominican Republic' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'SV', label: 'El Salvador' },
  { value: 'GD', label: 'Grenada' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'GY', label: 'Guyana' },
  { value: 'HT', label: 'Haiti' },
  { value: 'HN', label: 'Honduras' },
  { value: 'JM', label: 'Jamaica' },
  { value: 'MX', label: 'Mexico' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panama' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'PE', label: 'Peru' },
  { value: 'KN', label: 'Saint Kitts and Nevis' },
  { value: 'LC', label: 'Saint Lucia' },
  { value: 'VC', label: 'Saint Vincent and the Grenadines' },
  { value: 'SR', label: 'Suriname' },
  { value: 'TT', label: 'Trinidad and Tobago' },
  { value: 'US', label: 'United States' },
  { value: 'UY', label: 'Uruguay' },
  { value: 'VE', label: 'Venezuela' },
]

const Home = () => {
  const [email, setEmail] = createSignal('')
  const [country, setCountry] = createSignal('')

  return (
    <div>
      <Header />
      <h1>VTTC</h1>
      <Button color="#3498db">Hello</Button>
      <Button color="#27ae60">Save</Button>
      <Button color="#f39c12">Submit</Button>
      <Button color="#e74c3c">Cancel</Button>
      <Input
        label="Email Address"
        name="email"
        value={email()}
        onChange={setEmail}
        type="email"
        required
      />
      <Select
        label="Country"
        name="country"
        value={country()}
        onChange={setCountry}
        options={americanCountries}
      />
      <PlayerList />
    </div>
  )
}

export default Home
