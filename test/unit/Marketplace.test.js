const { assert, expect } = require('chai')
const { ethers } = require('hardhat')

const { AddressZero } = ethers.constants
const URI = 'http://uri'
const BASICNFTURI = 'BasicNftUri'
const RARENFTURI = 'RareNftUri'
const SUPERRARENFTURI = 'SuperRareNftUri'
const SALESSBTURI = 'SalesSbtUri'
const RARESBTURI = 'RareSbtUri'
const SUPERSBTURI = 'SuperSecretSbtUri'
const REGISTRY_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('REGISTRY_ROLE'))
const MARKETPLACE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MARKETPLACE_ROLE'))
const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'))
const SOULBOUNDS_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('SOULBOUNDS_ROLE'))
const randomAddress = ethers.utils.hexlify(ethers.utils.randomBytes(20))
const minterPrice = ethers.utils.parseEther('0.1')
const nftPrice = ethers.utils.parseEther('0.5')

let accounts,
    owner,
    registryRole,
    marketplaceRole,
    minterRole,
    sbtRole,
    anyone,
    user1,
    user2,
    control,
    registry,
    marketplace,
    minter,
    soulbounds,
    holder,
    random,
    VRFMock

describe('Marketplace', async () => {
    beforeEach(async () => {
        accounts = await ethers.getSigners()
        owner = accounts[0]
        registryRole = accounts[1]
        marketplaceRole = accounts[2]
        minterRole = accounts[3]
        sbtRole = accounts[4]
        anyone = accounts[5]
        user1 = accounts[6]
        user2 = accounts[7]

        ControlContract = await ethers.getContractFactory('Control')
        control = await ControlContract.deploy(
            registryRole.address,
            marketplaceRole.address,
            minterRole.address,
            sbtRole.address
        )
        await control.deployed()

        const RegistryContract = await ethers.getContractFactory('Registry')
        registry = await RegistryContract.deploy()
        await registry.deployed()

        const MarketplaceContract = await ethers.getContractFactory('Marketplace')
        marketplace = await MarketplaceContract.deploy(control.address, registry.address)
        await marketplace.deployed()

        const MinterContract = await ethers.getContractFactory('Minter')
        minter = await MinterContract.deploy(control.address, registry.address)
        await minter.deployed()

        const SoulboundsContract = await ethers.getContractFactory('Soulbounds')
        soulbounds = await SoulboundsContract.deploy(
            control.address,
            registry.address,
            SALESSBTURI,
            RARESBTURI,
            SUPERSBTURI
        )
        await soulbounds.deployed()

        const HolderContract = await ethers.getContractFactory('Holder')
        holder = await HolderContract.deploy([owner.address], ['100'])
        await holder.deployed()

        const VRFCoordinatorMock = await ethers.getContractFactory('VRFCoordinatorV2Mock')
        VRFMock = await VRFCoordinatorMock.deploy('100000000000000000', '1000000000')
        await VRFMock.createSubscription()
        await VRFMock.fundSubscription('1', ethers.utils.parseEther('1'))

        RandomContract = await ethers.getContractFactory('Random')
        random = await RandomContract.deploy(registry.address, VRFMock.address, [
            BASICNFTURI,
            RARENFTURI,
            SUPERRARENFTURI,
        ])
        await random.deployed()

        await VRFMock.addConsumer('1', random.address)

        await control.connect(registryRole).setRegistry(registry.address)
        await registry.setMinterContract(minter.address)
        await registry.setMarketplaceContract(marketplace.address)
        await registry.setRandomContract(random.address)
        await registry.setSoulboundsContract(soulbounds.address)
        await registry.setHolderAddress(holder.address)
        await registry.setOracleParams(
            '1',
            '0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f',
            '500000'
        )
        await control.connect(minterRole).setPriceMinter(minterPrice)
        await control.connect(minterRole).activateMinter()
    })

    it('List item correct', async () => {
        expect(await minter.requestItem({ value: minterPrice })).to.emit('ItemRequested')
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        expect(await marketplace.listItem(random.address, '0', nftPrice)).to.emit('ItemListed')
        const listing = await marketplace.getListing(random.address, '0')
        assert.equal(Number(listing[0]).toString(), nftPrice)
        assert.equal(listing[1], owner.address)
    })

    it('Reverts if try listing item that already listed', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        await expect(marketplace.listItem(random.address, '0', nftPrice)).to.be.revertedWith(
            'Marketplace: Already listed'
        )
    })
    it('Reverts if try listing not owner of nft', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await expect(
            marketplace.connect(anyone).listItem(random.address, '0', nftPrice)
        ).to.be.revertedWith('Marketplace: Not owner')
    })
    it('Reverts if try list with zero price', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await expect(marketplace.listItem(random.address, '0', '0')).to.be.revertedWith(
            'Marketplace: Price must be greater then zero'
        )
    })
    it('Reverts if try list item that not approved for marketplace', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await expect(marketplace.listItem(random.address, '0', nftPrice)).to.be.revertedWith(
            'Marketplace: Not approved for marketplace'
        )
    })
    it('Buy item protected from re-entrancy', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        marketplace.buyItem(random.address, '0', { value: nftPrice })
        expect(marketplace.buyItem(random.address, '0')).to.be.revertedWith(
            'ReentrancyGuard: reentrant call'
        )
    })
    it('Reverts if try buy item that not listed', async () => {
        expect(marketplace.buyItem(random.address, '0')).to.be.revertedWith(
            'Marketplace: Not listed'
        )
    })
    it('Reverts if try buy item and price not met', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        await expect(
            marketplace
                .connect(anyone)
                .buyItem(random.address, '0', { value: '1' })
        ).to.be.revertedWith('Marketplace: Price not met')
    })
    it('Marketplace fee correct transfers to holder contract', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        await marketplace.buyItem(random.address, '0', { value: nftPrice })
        const marketplaceProceeds =
            (Number(nftPrice) * Number(await marketplace.getMarketplaceFee())) / 10000
        const holderBalanceAfter = Number(await ethers.provider.getBalance(holder.address))
        assert.equal(
            (holderBalanceAfter - Number(minterPrice)).toString(),
            marketplaceProceeds.toString()
        )
    })
    it('Seller proceeds stores correct when item selled,lising deleted,nft transfered,event emited, it withdraws correct and seller proceeds zero after', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        expect(
            await marketplace.connect(anyone).buyItem(random.address, '0', { value: nftPrice })
        ).to.emit('ItemBought')
        assert.equal(await random.ownerOf('0'), anyone.address)
        const marketplaceProceeds =
            (Number(nftPrice) * Number(await marketplace.getMarketplaceFee())) / 10000
        const sellerProceeds = Number(nftPrice) - marketplaceProceeds
        assert.equal(await marketplace.getProceeds(owner.address), sellerProceeds.toString())
        const sellerBalanceBefore = await owner.getBalance()
        const tx = await marketplace.withdrawProceeds()
        await tx.wait()
        const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
        const gasCost = Number(receipt.gasUsed.mul(tx.gasPrice))
        const sellerBalanceAfter = await owner.getBalance()
        assert.equal(
            (Number(sellerBalanceBefore) + sellerProceeds).toString(),
            (Number(sellerBalanceAfter) + gasCost).toString()
        )
        const listingAfter = await marketplace.getListing(random.address, '0')
        assert.equal(listingAfter[0].toString(), '0')
        assert.equal(listingAfter[1], AddressZero)
        assert.equal(await marketplace.getProceeds(owner.address), '0')
    })

    it('Mint acheivement soulbound when enough sales accumulated', async () => {
        await minter.requestItem({ value: minterPrice })
        await minter.requestItem({ value: minterPrice })
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await VRFMock.fulfillRandomWords('2', random.address)
        await VRFMock.fulfillRandomWords('3', random.address)
        await random.approve(marketplace.address, '0')
        await random.approve(marketplace.address, '1')
        await random.approve(marketplace.address, '2')
        await marketplace.listItem(random.address, '0', nftPrice)
        await marketplace.listItem(random.address, '1', nftPrice)
        await marketplace.listItem(random.address, '2', nftPrice)
        await marketplace.connect(anyone).buyItem(random.address, '0', { value: nftPrice })
        await marketplace.connect(anyone).buyItem(random.address, '1', { value: nftPrice })
        await marketplace.connect(anyone).buyItem(random.address, '2', { value: nftPrice })
        assert.equal(await soulbounds.balanceOf(owner.address, '0'), '1')
    })

    it('Reverts if not owner try cancel listing', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        await expect(
            marketplace.connect(anyone).cancelListing(random.address, '0')
        ).to.be.revertedWith('Marketplace: Not owner')
    })
    it('Reverts if try cancel listing if item not listed', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await expect(marketplace.cancelListing(random.address, '0')).to.be.revertedWith(
            'Marketplace: Not listed'
        )
    })
    it('Cancel listing emits event and delete listing', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        expect(await marketplace.cancelListing(random.address, '0')).to.emit('ItemCanceled')
        const listing = await marketplace.getListing(random.address, '0')
        assert.equal(listing[1], AddressZero)
        assert.equal(listing[0].toString(), '0')
    })

    it('Reverts if not owner try update listing', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        await expect(
            marketplace.connect(anyone).updateListing(random.address, '0', nftPrice)
        ).to.be.revertedWith('Marketplace: Not owner')
    })
    it('Reverts if try updated listing if item not listed', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await expect(marketplace.updateListing(random.address, '0', nftPrice)).to.be.revertedWith(
            'Marketplace: Not listed'
        )
    })
    it('Updating listing emits event and update price', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        expect(await marketplace.updateListing(random.address, '0', minterPrice)).to.emit(
            'ItemListed'
        )
        const listing = await marketplace.getListing(random.address, '0')
        assert.equal(listing[0].toString(), minterPrice)
    })

    it('Reverts if try withdraw proceeds and proceeds is zero', async () => {
        await expect(marketplace.withdrawProceeds()).to.be.revertedWith('Marketplace: No Proceeds')
    })
    it('Withdraw proceeds emits event', async () => {
        await minter.requestItem({ value: minterPrice })
        await VRFMock.fulfillRandomWords('1', random.address)
        await random.approve(marketplace.address, '0')
        await marketplace.listItem(random.address, '0', nftPrice)
        await marketplace.buyItem(random.address, '0', { value: nftPrice })
        expect(await marketplace.withdrawProceeds()).to.emit('ProceedsWithdrawed')
    })

    it('Reverts if no control contract try set marketplace fee', async () => {
        await expect(marketplace.connect(owner).setMarketplaceFee('100')).to.be.revertedWith(
            'Marketplace: Caller is not control contract'
        )
        await expect(marketplace.connect(anyone).setMarketplaceFee('100')).to.be.revertedWith(
            'Marketplace: Caller is not control contract'
        )
        await expect(marketplace.connect(minterRole).setMarketplaceFee('100')).to.be.revertedWith(
            'Marketplace: Caller is not control contract'
        )
        await expect(marketplace.connect(sbtRole).setMarketplaceFee('100')).to.be.revertedWith(
            'Marketplace: Caller is not control contract'
        )
        await expect(
            marketplace.connect(marketplaceRole).setMarketplaceFee('100')
        ).to.be.revertedWith('Marketplace: Caller is not control contract')
    })
    it('Reverts if control contract try set the same marketplace fee', async () => {
        await expect(control.connect(marketplaceRole).setMarketplaceFee('200')).to.be.revertedWith(
            'Marketplace: Fee the same'
        )
    })
})
